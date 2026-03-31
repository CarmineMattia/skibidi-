export interface HomeCategory {
  id: number;
  name: string;
  icon: string;
  color: string;
}

export interface HomeTrendingPizza {
  id: string;
  name: string;
  description: string;
  price: number;
  badge: string;
  image: string;
  imageUrl?: string;
}

export interface HomeRecentOrder {
  id: string;
  date: string;
  total: number;
  status: string;
}
