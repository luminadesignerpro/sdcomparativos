export enum ViewMode {
  DASHBOARD = 'DASHBOARD',
  PROMOB = 'PROMOB',
  CONTRACTS = 'CONTRACTS',
  CRM = 'CRM',
  CLIENT_PORTAL = 'CLIENT_PORTAL',
  PORTFOLIO = 'PORTFOLIO',
  TIME_TRACKING = 'TIME_TRACKING',
  FLEET = 'FLEET',
  AFTER_SALES = 'AFTER_SALES',
  QUALITY_CHECK = 'QUALITY_CHECK',
  PROJECT_COSTS = 'PROJECT_COSTS',
  WARRANTY = 'WARRANTY',
  FUEL = 'FUEL',
  TOOLS = 'TOOLS',
  SUPPLIERS = 'SUPPLIERS',
  PRODUCTS = 'PRODUCTS',
  SERVICE_ORDERS = 'SERVICE_ORDERS',
  CASH_REGISTER = 'CASH_REGISTER',
  ACCOUNTS_PAYABLE = 'ACCOUNTS_PAYABLE',
  ACCOUNTS_RECEIVABLE = 'ACCOUNTS_RECEIVABLE',
  CONTRACTS_MGMT = 'CONTRACTS_MGMT',
  DASHBOARD_3D = 'DASHBOARD_3D',
  INTERNAL_CHAT = 'INTERNAL_CHAT',
  APPOINTMENTS = 'APPOINTMENTS',
  PROFIT_BI = 'PROFIT_BI',
  BUDGET_QUOTE = 'BUDGET_QUOTE',
  AR_STUDIO = 'AR_STUDIO',
  AI_SALES = 'AI_SALES',
  INTEGRATION = 'INTEGRATION',
  PDF_DOWNLOADER = 'PDF_DOWNLOADER',
  SMART_MEASUREMENT = 'SMART_MEASUREMENT',
  PROJECT_GALLERY = 'PROJECT_GALLERY',
  TRACKING = 'TRACKING',
  PLAYCANVAS = 'PLAYCANVAS',
  LEGACY_SYSTEM = 'LEGACY_SYSTEM',
  OS_REPORT = 'OS_REPORT',
}

export enum ToolMode {
  SELECT = 'SELECT',
  MOVE = 'MOVE',
  ROTATE = 'ROTATE',
}

export enum ViewportMode {
  PERSPECTIVE = 'PERSPECTIVE',
  TOP = 'TOP',
  FRONT = 'FRONT',
  SIDE = 'SIDE',
}

export interface ProjectDimensions {
  floorWidth: number;
  floorDepth: number;
  wallHeight: number;
}

export interface ProjectSettings {
  floorTexture: string;
  wallColor: string;
  ceilingVisible: boolean;
}

export interface FurnitureModule {
  id: string;
  type: string;
  category: string;
  price: number;
  width: number;
  height: number;
  depth: number;
  x: number;
  y: number;
  z: number;
  finish: string;
  isRipado: boolean;
  rotation: number;
  isAppliance?: boolean;
  applianceType?: 'fridge' | 'stove' | 'washing_machine' | 'microwave' | 'range_hood' | 'sink';
  hasGlass?: boolean;
  handleType?: 'bar' | 'knob' | 'pull' | 'shell';
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  modules: FurnitureModule[];
  floorWidth: number;
  floorDepth: number;
  wallHeight: number;
  settings: ProjectSettings;
}

export interface Contract {
  id: string;
  clientName: string;
  document: string;
  projectName: string;
  value: number;
  status: 'Em Negociação' | 'Assinado' | 'Produção' | 'Instalação' | 'Concluído';
  date: string;
  email: string;
  phone: string;
  paymentStatus: 'Pendente' | 'Parcial' | 'Pago';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'admin' | 'client' | 'ai';
  text: string;
  time: string;
}

export interface ModuleTemplate {
  id: string;
  type: string;
  category: string;
  price: number;
  icon: string;
  w: number;
  h: number;
  d: number;
  z: number;
  isAppliance?: boolean;
  applianceType?: 'fridge' | 'stove' | 'washing_machine' | 'microwave' | 'range_hood' | 'sink';
  hasGlass?: boolean;
  handleType?: 'bar' | 'knob' | 'pull' | 'shell';
}

// Tipos para o Sistema de Orçamento com Foto
export type DimensionDetectionMethod = 'reference_object' | 'ai_analysis' | 'stereo_vision' | 'manual';

export interface RoomPhoto {
  id: string;
  imageData: string; // base64
  timestamp: Date;
  method: DimensionDetectionMethod;
}

export interface DetectedDimensions {
  width: number;
  height: number;
  depth: number;
  confidence: number; // 0-100%
  method: DimensionDetectionMethod;
}

export interface PlacedFurniture {
  id: string;
  templateId: string;
  x: number; // posição na foto (0-1)
  y: number;
  scale: number;
  rotation: number;
}

export interface BudgetQuote {
  id: string;
  roomPhotos: RoomPhoto[];
  detectedDimensions: DetectedDimensions | null;
  placedFurniture: PlacedFurniture[];
  materials: BudgetMaterial[];
  laborCost: number;
  totalValue: number;
  createdAt: Date;
  status: 'draft' | 'analyzing' | 'ready' | 'sent';
}

export interface BudgetMaterial {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface FurnitureCatalogItem {
  id: string;
  name: string;
  category: 'kitchen' | 'bedroom' | 'living_room' | 'office' | 'bathroom' | 'storage';
  basePrice: number;
  pricePerUnit: number; // preço por m²
  defaultWidth: number;
  defaultHeight: number;
  defaultDepth: number;
  imageUrl: string;
  description: string;
  materials: string[];
}
