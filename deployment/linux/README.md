# Linux deployment for EcaAfrica backend

This folder contains the production-ready deployment files for the backend service.

## 1) Prepare the Linux server

```bash
sudo mkdir -p /etc/ecareafrica
sudo mkdir -p /srv/ecareafrica
sudo useradd --system --create-home --home-dir /srv/ecareafrica --shell /usr/sbin/nologin ecareafrica || true
sudo chown -R ecareafrica:ecareafrica /srv/ecareafrica
```

## 2) One-click deployment script

```bash
sudo cp /path/to/Ecareafrica_backend/deployment/linux/deploy-production.sh /tmp/deploy-production.sh
sudo chmod +x /tmp/deploy-production.sh
sudo bash /tmp/deploy-production.sh
```

This script will:
- create the `/etc/wireguard` folder if needed
- generate server keys if missing
- create `/etc/wireguard/wg0.conf`
- copy `/etc/ecareafrica/backend.env` if present
- install and restart the systemd service
- build the backend application

## 3) Copy the production env file

```bash
sudo cp /path/to/Ecareafrica_backend/.env.production /etc/ecareafrica/backend.env
sudo nano /etc/ecareafrica/backend.env
```

Update the database credentials, JWT secrets, SMTP credentials, S3 values, and any live domain names.

## 4) Copy the service file

```bash
sudo cp /path/to/Ecareafrica_backend/deployment/linux/ecareafrica-backend.service /etc/systemd/system/ecareafrica-backend.service
sudo systemctl daemon-reload
sudo systemctl enable ecareafrica-backend
sudo systemctl start ecareafrica-backend
sudo systemctl status ecareafrica-backend --no-pager
```

## 5) Build the backend on the server

```bash
cd /srv/ecareafrica/Ecareafrica_backend
npm install
npm run build
```

## 6) WireGuard requirements for the real VPN flow

The backend reads these values from the environment:

- WG_CONF_PATH=/etc/wireguard/wg0.conf
- WG_PUBKEY_PATH=/etc/wireguard/server_public.key
- WG_INTERFACE=wg0
- WG_PORT=51820
- SERVER_PUBLIC_IP=169.58.124.150
- SERVER_VPN_IP=10.0.0.1
- VPN_SUBNET=10.0
- VPN_CIDR=16

Generate the server keys:

```bash
sudo apt update
sudo apt install -y wireguard
sudo mkdir -p /etc/wireguard
sudo chmod 700 /etc/wireguard
sudo bash -c 'wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key'
sudo chmod 600 /etc/wireguard/server_private.key
sudo chmod 644 /etc/wireguard/server_public.key
```

Create the tunnel config:

```bash
sudo bash -c 'cat > /etc/wireguard/wg0.conf <<EOF
[Interface]
Address = 10.0.0.1/16
PrivateKey = $(cat /etc/wireguard/server_private.key)
ListenPort = 51820
SaveConfig = true
EOF'
```

Start it:

```bash
sudo wg-quick up /etc/wireguard/wg0.conf
sudo wg show wg0
sudo ufw allow 51820/udp
```

## 7) Optional Nginx reverse proxy

```bash
sudo cp /path/to/Ecareafrica_backend/deployment/linux/ecareafrica-nginx.conf /etc/nginx/conf.d/ecareafrica.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 8) Production notes

- The browser should never SSH into the server.
- The browser should never contain the server SSH password or root credentials.
- The frontend must call the backend API only.
- The backend is the only component allowed to run `wg` commands on the server.

This is the real architecture used by this project.
