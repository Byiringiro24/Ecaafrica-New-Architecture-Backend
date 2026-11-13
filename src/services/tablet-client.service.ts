// Adapted from migration/Attendance_device_config_backend/src/utils/tablet-client.js

import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  FK623DeviceStatus,
  FK623ConnectConfig,
  FK623ConnectResponse,
  FK623DisconnectResponse,
  FK623PullLogsResponse,
  FK623GetUsersResponse,
  FK623AddUserResponse,
  FK623DeleteUserResponse,
  FK623SyncTimeResponse
} from '../types/fk623.types';

const API_TIMEOUT = parseInt(process.env.TABLET_API_TIMEOUT || '15000', 10);

export class TabletClientService {
  private baseURL: string;
  private client: AxiosInstance;
  private devPassword: string | null;

  constructor(tabletUrl: string, devPassword?: string | null) {
    this.baseURL = tabletUrl;
    this.devPassword = devPassword ?? null;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        ...(devPassword ? { 'X-Dev-Password': devPassword } : {}),
      },
    });
  }

  /** Update the dev password at runtime (e.g. after the tablet polls a new one) */
  setDevPassword(pw: string | null) {
    this.devPassword = pw;
    if (pw) {
      this.client.defaults.headers['X-Dev-Password'] = pw;
    } else {
      delete this.client.defaults.headers['X-Dev-Password'];
    }
  }

  async pullLogs(readMark: number = 0): Promise<FK623PullLogsResponse> {
    try {
      const response = await this.client.post('/api/device/pull-logs', {
        readMark,
      });
      return response.data;
    } catch (error) {
      console.error('Error pulling logs from tablet:', (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Pull logs from a SPECIFIC FK623 device by its bridge device-config ID.
   * Use this when a laptop has multiple FK623 units connected.
   * The bridge routes the GET_LOGS command to the correct device's FKBridge.exe instance.
   */
  async pullLogsForDevice(deviceConfigId: string, readMark: number = 0): Promise<FK623PullLogsResponse> {
    try {
      const response = await this.client.post(`/api/devices-config/${deviceConfigId}/pull-logs`, {
        readMark,
      });
      return response.data;
    } catch (error) {
      console.error(`Error pulling logs from device ${deviceConfigId}:`, (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }

  async addUser(userId: string, name: string, photoUrl?: string): Promise<FK623AddUserResponse> {
    try {
      const response = await this.client.post('/api/device/users', {
        userId,
        name,
        photoUrl: photoUrl ?? null,
      });
      return response.data;
    } catch (error) {
      console.error('Error adding user to device:', (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Add a user to a SPECIFIC FK623 device by its bridge device-config ID.
   * Use this when a laptop has multiple FK623 units — each device has its own
   * user database and biometric templates.
   */
  async addUserToDevice(deviceConfigId: string, userId: string, name: string, photoUrl?: string): Promise<FK623AddUserResponse> {
    try {
      const response = await this.client.post(`/api/devices-config/${deviceConfigId}/users`, {
        userId,
        name,
        photoUrl: photoUrl ?? null,
      });
      return response.data;
    } catch (error) {
      console.error(`Error adding user to device ${deviceConfigId}:`, (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }

  async deleteUser(userId: string): Promise<FK623DeleteUserResponse> {
    try {
      const response = await this.client.delete(`/api/device/users/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting user from device:', (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Delete a user from a SPECIFIC FK623 device by its bridge device-config ID.
   */
  async deleteUserFromDevice(deviceConfigId: string, userId: string): Promise<FK623DeleteUserResponse> {
    try {
      const response = await this.client.delete(`/api/devices-config/${deviceConfigId}/users/${userId}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting user from device ${deviceConfigId}:`, (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Get users from a SPECIFIC FK623 device by its bridge device-config ID.
   */
  async getUsersFromDevice(deviceConfigId: string): Promise<FK623GetUsersResponse> {
    try {
      const response = await this.client.get(`/api/devices-config/${deviceConfigId}/users`);
      return response.data;
    } catch (error) {
      console.error(`Error getting users from device ${deviceConfigId}:`, (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Clear logs on a SPECIFIC FK623 device by its bridge device-config ID.
   */
  async clearLogsOnDevice(deviceConfigId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await this.client.post(`/api/devices-config/${deviceConfigId}/clear-logs`);
      return response.data;
    } catch (error) {
      console.error(`Error clearing logs on device ${deviceConfigId}:`, (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Sync time on a SPECIFIC FK623 device by its bridge device-config ID.
   */
  async syncTimeOnDevice(deviceConfigId: string): Promise<FK623SyncTimeResponse> {
    try {
      const response = await this.client.post(`/api/devices-config/${deviceConfigId}/sync-time`);
      return response.data;
    } catch (error) {
      console.error(`Error syncing time on device ${deviceConfigId}:`, (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Rename a user on the FK623 device.
   * The FK623 SDK has no UPDATE command — we delete and re-add with the new name.
   * Biometric templates are preserved by the device hardware.
   */
  async renameUser(userId: string, newName: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Delete the old user entry
      await this.client.delete(`/api/device/users/${userId}`);
      // Re-add with the new name
      const response = await this.client.post('/api/device/users', { userId, name: newName });
      return response.data;
    } catch (error) {
      console.error('Error renaming user on device:', (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Push all (or selected) students to the FK623 device.
   * The bridge enrolls each student by their device user ID + name.
   */
  async pushStudents(studentIds?: string[]): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await this.client.post('/api/device/push-students', {
        ...(studentIds ? { studentIds } : {}),
      });
      return response.data;
    } catch (error) {
      console.error('Error pushing students to device:', (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }

  async getDeviceStatus(): Promise<FK623DeviceStatus> {
    try {
      const response = await this.client.get('/api/device/status');
      return response.data;
    } catch (error) {
      console.error('Error getting device status:', (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Connect to FK623 using the bridge's own saved device config.
   * The bridge manages the FK623 IP internally — we never send IP params
   * to avoid the IP mismatch 400 error. If already connected, returns immediately.
   */
  async connectDevice(_config?: FK623ConnectConfig): Promise<FK623ConnectResponse> {
    try {
      const response = await this.client.post('/api/device/connect-saved');
      return response.data;
    } catch (error) {
      console.error('Error connecting device:', (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Trigger reconnect for a SPECIFIC FK623 device via its bridge device-config ID.
   * The bridge's auto-connect loop already handles this, but we can nudge it
   * by calling the connect endpoint explicitly.
   */
  async connectDeviceById(deviceConfigId: string): Promise<FK623ConnectResponse> {
    try {
      const response = await this.client.post(`/api/devices-config/${deviceConfigId}/connect`);
      return response.data;
    } catch (error) {
      console.error(`Error connecting device ${deviceConfigId}:`, (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }
  async connectDeviceExplicit(config: FK623ConnectConfig): Promise<FK623ConnectResponse> {
    try {
      const response = await this.client.post('/api/device/connect', {
        ipAddress: config.ipAddress,
        port: config.port,
        license: config.license,
        saveConfig: true,   // tell the bridge to persist this as the saved config
      });
      return response.data;
    } catch (error) {
      console.error('Error connecting device:', (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }

  async disconnectDevice(): Promise<FK623DisconnectResponse> {
    try {
      const response = await this.client.post('/api/device/disconnect');
      return response.data;
    } catch (error) {
      console.error('Error disconnecting device:', (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }

  async getUsers(): Promise<FK623GetUsersResponse> {
    try {
      const response = await this.client.get('/api/device/users');
      return response.data;
    } catch (error) {
      console.error('Error getting users from device:', (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }

  async health(): Promise<{ success: boolean; version?: string }> {
    try {
      const response = await this.client.get('/api/health');
      return response.data;
    } catch (error) {
      console.error('Error checking tablet health:', (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }

  async syncTime(): Promise<FK623SyncTimeResponse> {
    try {
      const response = await this.client.post('/api/device/sync-time');
      return response.data;
    } catch (error) {
      console.error('Error syncing time:', (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }

  async setTime(datetime: string): Promise<FK623SyncTimeResponse> {
    try {
      const response = await this.client.post('/api/device/set-time', { datetime });
      return response.data;
    } catch (error) {
      console.error('Error setting time:', (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }

  async clearLogs(): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await this.client.post('/api/device/clear-logs');
      return response.data;
    } catch (error) {
      console.error('Error clearing logs:', (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }

  async clearAll(): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await this.client.post('/api/device/clear-all');
      return response.data;
    } catch (error) {
      console.error('Error clearing device data:', (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Clear ALL users + logs on a SPECIFIC FK623 device by its bridge device-config ID.
   * Each FK623 has its own user database — this only wipes the targeted device.
   */
  async clearAllOnDevice(deviceConfigId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await this.client.post(`/api/devices-config/${deviceConfigId}/clear-all`);
      return response.data;
    } catch (error) {
      console.error(`Error clearing device ${deviceConfigId}:`, (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }

  async powerOff(): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await this.client.post('/api/device/poweroff');
      return response.data;
    } catch (error) {
      console.error('Error powering off device:', (error as Error).message);
      throw this.handleError(error as AxiosError);
    }
  }

  private handleError(error: AxiosError): Error {
    if (error.response) {
      // Server responded with error status
      const message = (error.response.data as any)?.error || error.message;
      return new Error(`Tablet error: ${message}`);
    } else if (error.request) {
      // Request made but no response
      return new Error('Tablet unreachable: No response received');
    } else {
      // Something else happened
      return new Error(`Tablet client error: ${error.message}`);
    }
  }
}
