# Despliegue en Ubuntu 26 / Contabo

Guia para subir el proyecto a GitHub y correrlo en un VPS Ubuntu.

## 1. Preparar GitHub desde tu PC

```powershell
cd C:\Users\chago\Documents\Codex\2026-07-19\referenced-chatgpt-conversation-this-is-untrusted\work\tokenizas-app
git init
git add .
git commit -m "Initial Tokenizas Dominicana app"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/tokenizas-dominicana.git
git push -u origin main
```

No subas `node_modules`, `.env`, logs ni la base SQLite local. Ya estan excluidos en `.gitignore`.

## 2. Preparar el servidor Ubuntu

Entrar al VPS:

```bash
ssh root@IP_DEL_SERVIDOR
```

Actualizar paquetes:

```bash
apt update && apt upgrade -y
apt install -y curl git nginx ufw
```

Instalar Node.js 22 LTS:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v
npm -v
```

## 3. Descargar la app

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/TU-USUARIO/tokenizas-dominicana.git
cd tokenizas-dominicana
npm install --omit=dev
cp .env.example .env
npm run seed
```

Dar permisos al usuario del servicio:

```bash
chown -R www-data:www-data /var/www/tokenizas-dominicana
```

## 4. Crear servicio systemd

```bash
cp deploy/tokenizas-dominicana.service /etc/systemd/system/tokenizas-dominicana.service
systemctl daemon-reload
systemctl enable tokenizas-dominicana
systemctl start tokenizas-dominicana
systemctl status tokenizas-dominicana
```

Probar localmente:

```bash
curl http://127.0.0.1:3000/health
```

## 5. Configurar Nginx

```bash
cp deploy/nginx-tokenizas.conf /etc/nginx/sites-available/tokenizas-dominicana
ln -s /etc/nginx/sites-available/tokenizas-dominicana /etc/nginx/sites-enabled/tokenizas-dominicana
nginx -t
systemctl reload nginx
```

Abrir firewall:

```bash
ufw allow OpenSSH
ufw allow "Nginx Full"
ufw --force enable
```

## 6. Apuntar dominio

En el DNS de `dominicana.com`, crea un registro:

```text
Tipo: A
Nombre: tokenizas
Valor: IP_DEL_SERVIDOR
TTL: 300
```

Cuando el DNS propague:

```bash
curl -I http://tokenizas.dominicana.com
```

## 7. Activar HTTPS

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d tokenizas.dominicana.com
```

## 8. Actualizar despues de cambios

```bash
cd /var/www/tokenizas-dominicana
git pull
npm install --omit=dev
systemctl restart tokenizas-dominicana
```

## Notas importantes

- Esta version usa SQLite para pruebas y piloto.
- La base queda en `/var/www/tokenizas-dominicana/data/tokenizas.sqlite`.
- Haz backup de `data/tokenizas.sqlite` antes de actualizar o reinstalar.
- Para produccion real con dinero de terceros, agrega autenticacion, KYC real, pagos, custodia, auditoria legal y smart contracts auditados.
