// Codificador de palabras ARINC 429 (32 bits)
//
//  bit  32   | 31 30 | 29 ............ 11 | 10 9 | 8 ....... 1
//  paridad   |  SSM  |  DATOS BNR (19 b)  | SDI  | LABEL (octal)
//
// - Label: 8 bits, se escribe en octal y se transmite invertido (bit 1 = MSB del label)
// - SDI: 2 bits (00 = todos los receptores)
// - Datos: 19 bits en BNR (complemento a 2), bit 29 = signo
// - SSM: 2 bits, 11 = operacion normal
// - Paridad: impar (la cantidad total de unos tiene que ser impar)

function codificar({ label, minimo, maximo, valor, sdi = 0, ssm = 3 }) {
  valor = Number(valor); minimo = Number(minimo); maximo = Number(maximo);
  if (Number.isNaN(valor)) throw new Error('El valor no es un numero');
  if (valor < minimo || valor > maximo) {
    throw new Error(`El valor ${valor} esta fuera de rango (${minimo} a ${maximo})`);
  }
  if (!/^[0-3][0-7]{2}$/.test(String(label))) throw new Error('Label octal invalido (000 a 377)');

  // 1) Label: octal -> 8 bits, invertidos
  const labelNum = parseInt(label, 8);
  let labelInv = 0;
  for (let i = 0; i < 8; i++) if (labelNum & (1 << i)) labelInv |= 1 << (7 - i);

  // 2) Datos BNR: el rango completo (escala) es el mayor modulo entre min y max
  const escala = Math.max(Math.abs(minimo), Math.abs(maximo)) || 1;
  const resolucion = escala / (2 ** 18 - 1);          // 18 bits de magnitud + 1 de signo
  let datos = Math.round(valor / resolucion);
  if (datos < 0) datos = (2 ** 19) + datos;            // complemento a 2 en 19 bits
  datos &= 0x7FFFF;

  // 3) Armar la palabra (bits 1..31)
  let palabra = labelInv
    | ((sdi & 0b11) << 8)
    | (datos << 10)
    | ((ssm & 0b11) << 29);
  palabra >>>= 0;

  // 4) Paridad impar en el bit 32
  let unos = 0;
  for (let i = 0; i < 31; i++) if (palabra & (1 << i)) unos++;
  if (unos % 2 === 0) palabra = (palabra | (1 << 31)) >>> 0;

  const bin = palabra.toString(2).padStart(32, '0'); // bit 32 a la izquierda
  const hex = palabra.toString(16).toUpperCase().padStart(8, '0');
  return { palabra, bin, hex, resolucion };
}

// Decodifica para verificar los codigos generados (paso 9.3)
function decodificar(palabra, { minimo, maximo }) {
  palabra >>>= 0;
  let unos = 0;
  for (let i = 0; i < 32; i++) if (palabra & (1 << i)) unos++;
  const labelInv = palabra & 0xFF;
  let labelNum = 0;
  for (let i = 0; i < 8; i++) if (labelInv & (1 << i)) labelNum |= 1 << (7 - i);
  let datos = (palabra >>> 10) & 0x7FFFF;
  if (datos & 0x40000) datos -= 2 ** 19;
  const escala = Math.max(Math.abs(minimo), Math.abs(maximo)) || 1;
  return {
    label: labelNum.toString(8).padStart(3, '0'),
    sdi: (palabra >>> 8) & 0b11,
    valor: datos * (escala / (2 ** 18 - 1)),
    ssm: (palabra >>> 29) & 0b11,
    paridadOk: unos % 2 === 1,
  };
}

module.exports = { codificar, decodificar };
