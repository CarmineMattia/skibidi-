import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('@/lib/api/supabase', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('@/lib/stores/AuthContext', () => ({
  useAuth: () => ({ isCustomer: true, user: { id: 'customer-1' } }),
}));
vi.mock('@/lib/stores/TenantContext', () => ({
  useTenant: () => ({ companyId: 'company-1' }),
}));
vi.mock('expo-router', () => ({
  useRouter: () => ({ push: () => undefined, back: () => undefined }),
}));
vi.mock('@expo/vector-icons', () => ({ FontAwesome: () => null }));

import { CustomerConsentCard } from '../../components/features/CustomerConsentCard';

const notice = [{ version: '2026-11-draft-1', title: 'Informativa', body: 'BOZZA DA FAR RILEGGERE' }];
const savedChoices = [
  { purpose: 'marketing', granted: false, document_version: '2026-11-draft-1', updated_at: '2026-11-11T18:00:00Z' },
  { purpose: 'profiling', granted: false, document_version: '2026-11-draft-1', updated_at: '2026-11-11T18:00:00Z' },
];

function consentReadFails() {
  mocks.rpc.mockImplementation(async (name: string) => {
    if (name === 'get_my_consent') return { data: null, error: { message: 'network down', code: '500' } };
    if (name === 'current_consent_document') return { data: notice, error: null };
    if (name === 'get_my_consent_history') return { data: [], error: null };
    return { data: null, error: { message: `unexpected ${name}` } };
  });
}

function consentReadSucceeds() {
  mocks.rpc.mockImplementation(async (name: string, args?: { p_purpose?: string }) => {
    if (name === 'get_my_consent') return { data: savedChoices, error: null };
    if (name === 'current_consent_document') return { data: notice, error: null };
    if (name === 'get_my_consent_history') return { data: [], error: null };
    if (name === 'set_my_consent') return { data: { purpose: args?.p_purpose, granted: true }, error: null };
    return { data: null, error: { message: `unexpected ${name}` } };
  });
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

async function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let root: ReturnType<typeof create>;
  await act(async () => {
    root = create(createElement(QueryClientProvider, { client }, createElement(CustomerConsentCard, { variant: 'account' })));
  });
  await flush();
  return root!;
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.rpc.mockReset();
});

describe('lettura consensi fallita', () => {
  it('mostra l’errore e Riprova, e non chiama set_my_consent finché la lettura non riesce', async () => {
    consentReadFails();
    const root = await renderCard();
    const callsWhileUnknown = mocks.rpc.mock.calls.map((call) => call[0]);
    expect(callsWhileUnknown).toContain('get_my_consent');
    expect(callsWhileUnknown).not.toContain('set_my_consent');

    const text = JSON.stringify(root.toJSON());
    expect(text).toContain('Non riesco a leggere i tuoi consensi');
    expect(text).toContain('Riprova');
    expect(root.root.findAll((node) => node.props?.accessibilityRole === 'checkbox' && typeof node.props.onPress === 'function')).toHaveLength(0);

    consentReadSucceeds();
    const retry = root.root.find((node) => node.props?.accessibilityLabel === 'Riprova' && typeof node.props.onPress === 'function');
    await act(async () => {
      await retry.props.onPress();
    });
    await flush();

    const boxes = root.root.findAll((node) => node.props?.accessibilityRole === 'checkbox' && typeof node.props.onPress === 'function');
    expect(boxes.length).toBeGreaterThan(0);
    expect(JSON.stringify(root.toJSON())).toContain('Offerte personalizzate');
    expect(JSON.stringify(root.toJSON())).not.toContain('Non riesco a leggere i tuoi consensi');
    expect(boxes.every((box) => box.props.disabled !== true)).toBe(true);
    expect(mocks.rpc.mock.calls.map((call) => call[0])).not.toContain('set_my_consent');

    await act(async () => {
      boxes[0].props.onPress();
    });
    expect(mocks.rpc.mock.calls.some((call) => call[0] === 'set_my_consent' && call[1]?.p_purpose === 'marketing' && call[1]?.p_granted === true)).toBe(true);

    await act(async () => root.unmount());
  });
});
