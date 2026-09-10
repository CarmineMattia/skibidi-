import { describe, expect, test } from 'vitest';
import {
  finalizeDeliveryAddress,
  isAddressInDeliveryZone,
  isCoordinatesInDeliveryZone,
  looksLikeOutOfDeliveryZone,
} from '../../lib/utils/deliveryZone';

describe('isAddressInDeliveryZone', () => {
  test('allows Montecchio Emilia addresses', () => {
    expect(isAddressInDeliveryZone('Via E. Franchini 51, Montecchio Emilia')).toBe(true);
    expect(isAddressInDeliveryZone('Via Roma 12, 42027 Montecchio Emilia (RE)')).toBe(true);
  });

  test('allows Villa Aiola addresses', () => {
    expect(isAddressInDeliveryZone('Via Nazionale, Villa Aiola')).toBe(true);
    expect(isAddressInDeliveryZone('Aiola, Montecchio Emilia')).toBe(true);
    expect(isAddressInDeliveryZone('Villa Aiola, Unione Terre d\'Enza, Reggio nell\'Emilia')).toBe(
      true,
    );
  });

  test('rejects other towns', () => {
    expect(isAddressInDeliveryZone('Via Emilia, Reggio Emilia')).toBe(false);
    expect(isAddressInDeliveryZone('Piazza Duomo, Milano')).toBe(false);
    expect(isAddressInDeliveryZone('Via Roma, Montecchio Maggiore')).toBe(false);
    expect(isAddressInDeliveryZone('Via Roma 10, Parma')).toBe(false);
  });

  test('rejects a street with no locality', () => {
    expect(isAddressInDeliveryZone('Via Franchini, 51')).toBe(false);
    expect(isAddressInDeliveryZone('')).toBe(false);
  });

  test('flags typed addresses that clearly leave the zone', () => {
    expect(looksLikeOutOfDeliveryZone('Via Emilia, Reggio Emilia')).toBe(true);
    expect(looksLikeOutOfDeliveryZone('Piazza Duomo, Milano')).toBe(true);
    expect(looksLikeOutOfDeliveryZone('Via Roma, Scandiano')).toBe(true);
    expect(looksLikeOutOfDeliveryZone('Via XX Settembre, Rubiera')).toBe(true);
    expect(looksLikeOutOfDeliveryZone('Via Roma, Milano, 12')).toBe(true);
    expect(looksLikeOutOfDeliveryZone('Via Franchini')).toBe(false);
    expect(looksLikeOutOfDeliveryZone('Via Franchini, 51')).toBe(false);
    expect(looksLikeOutOfDeliveryZone('Via Franchini, Montecchio Emilia')).toBe(false);
  });

  test('finalizes street-only addresses in Montecchio Emilia', () => {
    expect(finalizeDeliveryAddress('Via Franchini, 51')).toBe(
      'Via Franchini, 51, Montecchio Emilia'
    );
    expect(finalizeDeliveryAddress('Via Nazionale, Villa Aiola')).toBe(
      'Via Nazionale, Villa Aiola'
    );
    expect(finalizeDeliveryAddress('Via Emilia, Reggio Emilia')).toBe(
      'Via Emilia, Reggio Emilia'
    );
    expect(finalizeDeliveryAddress('Via Roma, Milano, 12')).toBe('Via Roma, Milano, 12');
  });
});

describe('isCoordinatesInDeliveryZone', () => {
  test('allows Montecchio Emilia and Villa Aiola', () => {
    // Centro di Montecchio Emilia
    expect(isCoordinatesInDeliveryZone({ lat: 44.7004, lng: 10.4464 })).toBe(true);
    // Villa Aiola
    expect(isCoordinatesInDeliveryZone({ lat: 44.7154, lng: 10.4796 })).toBe(true);
  });

  test('rejects far coordinates', () => {
    // Reggio Emilia centro
    expect(isCoordinatesInDeliveryZone({ lat: 44.698, lng: 10.63 })).toBe(false);
    // Milano
    expect(isCoordinatesInDeliveryZone({ lat: 45.464, lng: 9.19 })).toBe(false);
    // Parma
    expect(isCoordinatesInDeliveryZone({ lat: 44.801, lng: 10.328 })).toBe(false);
  });
});
