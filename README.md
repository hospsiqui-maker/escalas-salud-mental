# Escalas Salud Mental

PWA local para aplicar un modulo breve de primera consulta en salud mental, mostrar resultados inmediatos al paciente y preparar archivos clinicos para Google Drive.

## Estado

MVP de prueba. No usar con pacientes reales hasta revisar consentimiento, textos legales, seguridad y flujo clinico.

## Desarrollo local

```powershell
python -m http.server 5173
```

Abrir:

```text
http://localhost:5173/
```

## Drive

Usa Google Identity Services y Google Drive API con scope limitado:

```text
https://www.googleapis.com/auth/drive.file
```
