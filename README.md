# ARINC-429-completo

CRUD de instrumentos aeronauticos y de envios, con generacion del codigo ARINC 429 de 32 bits,
salida por puerto serie y salida de tension por el auricular.

## Base de datos
```bash
sudo mysql < arinc429.sql
```

## Correr
```bash
npm install
npm start                              # sin puerto serie
SERIAL_PORT=/dev/ttyUSB0 npm start     # Linux, con puerto serie
set SERIAL_PORT=COM3 && npm start      # Windows, con puerto serie
```
Abrir http://localhost:3000

## Como funciona
- **Instrumentos**: nombre, label ARINC (octal), minimo, maximo y unidad.
- **Envios**: instrumento + valor. El servidor verifica que el valor este entre el minimo y el maximo y arma la palabra:

| Bits | 32 | 31-30 | 29-11 | 10-9 | 8-1 |
|---|---|---|---|---|---|
| Campo | Paridad impar | SSM (11 = normal) | Dato BNR, 19 bits en complemento a 2 | SDI | Label (invertido) |

- **Puerto serie**: manda `HEX;BINARIO\n` a 9600 baudios.
- **Auricular**: el boton "Auricular" genera la palabra como pulsos bipolares con retorno a cero (1 = tension positiva, 0 = negativa) a 1000 bits/s y la dibuja en pantalla.
- **Verificacion**: cada envio guardado se decodifica de nuevo y se muestra si el label, el valor y la paridad coinciden.

Prueba rapida del codificador: Altitud (label 203, -1000 a 50000) con 35000 pies da `EB3330C1`.
