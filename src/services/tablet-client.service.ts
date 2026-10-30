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

  constructor(tabletUrl: string) {
    this.baseURL = tabletUrl;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });
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

  async addUser(userId: string, name: string, photoUrl?: string): Promise<FK623AddUserResponse> {
    try {
      const response = await this.client.post('/api/device/users', {
        userId,
        name,
        photoUrl: photoUrl ?? null,   // tablet stores this for display on scan
      });
      return response.data;
    } catch (error) {
      console.error('Error adding user to device:', (error as Error).message);
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
   * Connect with explicit IP/port/license — only use from the Super Admin
   * "Link Device" form when first registering FK623 credentials on the bridge.
   * For auto-pull, use connectDevice() which calls connect-saved.
   */
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
