# Device Management Backend

## Overview

The device management module supports registration of tablet devices, assignment of students for push to device, device status refresh, and attendance log persistence.

## API Summary

- GET /api/v1/devices - list devices for the current school
- POST /api/v1/devices - register a device
- PATCH /api/v1/devices/:id - update device metadata
- POST /api/v1/devices/:id/push-students - push selected, class-based, or all students to a device
- GET /api/v1/devices/:id/status - read the latest device status and refresh the heartbeat
- GET /api/v1/devices/:id/logs - list logs stored for the device
- POST /api/v1/devices/:id/logs - create a new device attendance log

## Notes

- Keep the tablet port in the backend config only; do not change the frontend or backend application ports.
- Device status is derived from the heartbeat timestamp and refreshed automatically on status reads.
