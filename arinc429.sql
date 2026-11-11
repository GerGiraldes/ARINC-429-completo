-- =====================================================
-- 04 - BD3 - ARINC 429 completo
-- Correr con:  sudo mysql < arinc429.sql
-- =====================================================
CREATE DATABASE IF NOT EXISTS ARINC429_completo;
USE ARINC429_completo;

-- Instrumentos aeronauticos: nombre, minimo y maximo
-- (label = etiqueta ARINC en octal que identifica al instrumento)
CREATE TABLE IF NOT EXISTS instrumentos (
    ins_id      INTEGER      NOT NULL AUTO_INCREMENT PRIMARY KEY,
    ins_nombre  VARCHAR(50)  NOT NULL,
    ins_label   VARCHAR(3)   NOT NULL,
    ins_minimo  DOUBLE       NOT NULL,
    ins_maximo  DOUBLE       NOT NULL,
    ins_unidad  VARCHAR(20)
);

-- Envios: un instrumento + un valor + el codigo ARINC 429 generado
CREATE TABLE IF NOT EXISTS envios (
    env_id          INTEGER      NOT NULL AUTO_INCREMENT PRIMARY KEY,
    ins_id          INTEGER      NOT NULL,
    env_valor       DOUBLE       NOT NULL,
    env_codigo_bin  CHAR(32)     NOT NULL,
    env_codigo_hex  CHAR(8)      NOT NULL,
    env_fecha       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ins_id) REFERENCES instrumentos(ins_id)
);

INSERT INTO instrumentos (ins_nombre, ins_label, ins_minimo, ins_maximo, ins_unidad) VALUES
('Altitud',              '203', -1000, 50000, 'pies'),
('Velocidad (CAS)',      '206',     0,   450, 'nudos'),
('Rumbo magnetico',      '320',  -180,   180, 'grados'),
('Angulo de cabeceo',    '324',   -90,    90, 'grados'),
('Temperatura exterior', '213',   -80,    60, 'grados C');

CREATE USER IF NOT EXISTS 'arinc_app'@'localhost' IDENTIFIED BY 'arinc123';
GRANT ALL PRIVILEGES ON ARINC429_completo.* TO 'arinc_app'@'localhost';
FLUSH PRIVILEGES;
