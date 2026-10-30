// FK623 Device Types - Based on migration reference

export interface FK623DeviceStatus {
  connected: boolean;
  handle?: number;
  deviceId?: string;
  ipAddress?: string;
  port?: number;
  serialNumber?: string;
  productName?: string;
  productCode?: string;
  users?: number;
  logs?: number;
  faces?: number;
  fingerprints?: number;
  cards?: number;
  passwords?: number;
}

export interface FK623ConnectConfig {
  ipAddress: string;
  port: number;
  license: number;
}

export interface FK623ConnectResponse {
  success: boolean;
  handle?: number;
  deviceId?: string;
  serialNumber?: string;
  message?: string;
}

export interface FK623DisconnectResponse {
  success: boolean;
  message?: string;
}

export interface FK623AttendanceLog {
  id: string;
  studentId?: string;
  studentDeviceId?: string;
  studentName?: string;
  className?: string;
  section?: string;
  club?: string;
  deviceId?: string;
  authenticationMethod?: string | number;
  direction?: number | string; // 1=In, 2=Out, etc.
  directionLabel?: string;
  timestamp: string;
  status?: string;
}

export interface FK623PullLogsResponse {
  success: boolean;
  logs: FK623AttendanceLog[];
  count: number;
  readMark: number;
  message?: string;
}

export interface FK623User {
  userId: string;
  name: string;
  enabled?: boolean;
  privilege?: number;
  biometricMethods?: string[];
}

export interface FK623GetUsersResponse {
  success: boolean;
  users: FK623User[];
  count: number;
}

export interface FK623AddUserResponse {
  success: boolean;
  message?: string;
}

export interface FK623DeleteUserResponse {
  success: boolean;
  message?: string;
}

export interface FK623SyncTimeResponse {
  success: boolean;
  message?: string;
}
