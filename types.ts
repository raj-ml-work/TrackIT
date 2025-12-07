export enum AssetType {
  LAPTOP = 'Laptop',
  DESKTOP = 'Desktop',
  MONITOR = 'Monitor',
  PRINTER = 'Printer',
  ACCESSORY = 'Accessory',
  MOBILE = 'Mobile',
  PROJECTOR = 'Projector',
  TV = 'TV'
}

export enum AssetStatus {
  IN_USE = 'In Use',
  AVAILABLE = 'Available',
  MAINTENANCE = 'Maintenance',
  RETIRED = 'Retired'
}

export interface AssetSpecs {
  brand?: string;
  model?: string;
  cpu?: string; // Laptop, Desktop
  ram?: string; // Laptop, Desktop, Mobile
  storage?: string; // Laptop, Desktop, Mobile
  screenSize?: string; // Monitor, TV (e.g. "27 inch")
  printerType?: 'Color' | 'Monochrome'; // Printer
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  serialNumber: string;
  assignedTo?: string;
  purchaseDate: string;
  warrantyExpiry: string;
  cost: number;
  location: string;
  notes?: string;
  specs?: AssetSpecs;
}

export interface DashboardStats {
  totalAssets: number;
  totalValue: number;
  assignedRate: number;
  expiringWarranties: number;
}