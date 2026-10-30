export enum TabletStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  ERROR = 'error',
  MAINTENANCE = 'maintenance'
}

export interface Tablet {
  id: bigint;
  school_id: bigint;
  uuid: string;
  name: string;
  ip: string;
  port: number;
  url: string;
  status: TabletStatus;
  last_health_check: Date | null;
  health_check_interval: number;
  firmware_version: string | null;
  os_info: string | null;
  location: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CreateTabletInput {
  name: string;
  ip: string;
  port?: number;
  location?: string;
  notes?: string;
  firmware_version?: string;
  os_info?: string;
}

export interface UpdateTabletInput {
  name?: string;
  ip?: string;
  port?: number;
  location?: string;
  notes?: string;
  firmware_version?: string;
  os_info?: string;
  is_active?: boolean;
  school_id?: string | number | bigint;
}

export interface TabletHealthResponse {
  healthy: boolean;
  responseTime?: number;
  version?: string;
  error?: string;
  timestamp: Date;
}

export interface TabletFilters {
  status?: TabletStatus;
  search?: string;
  is_active?: boolean;
}

export interface PaginatedTablets {
  data: Tablet[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
