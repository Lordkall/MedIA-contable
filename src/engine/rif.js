/**
 * Validador de RIF (Registro de Información Fiscal) Venezolano
 * Algoritmo oficial Módulo 11 del SENIAT
 * Formatos válidos: V-12345678-9, J-12345678-9, G-12345678-9, E-12345678-9, C-12345678-9
 */

const FACTORES = [4, 3, 2, 7, 6, 5, 4, 3, 2];

const PREFIJOS = {
    'V': 1,
    'E': 2,
    'J': 3,
    'P': 4,
    'G': 5,
    'C': 6
};

function normalizarRIF(rifStr) {
    if (!rifStr) return '';
    return rifStr.toUpperCase().replace(/[^VEJPG0-9]/g, '');
}

function validarRIF(rifCompleto) {
    if (!rifCompleto) return { valido: false, error: 'RIF vacío' };

    const limpio = normalizarRIF(rifCompleto);
    if (limpio.length < 9 || limpio.length > 10) {
        return { valido: false, error: 'Longitud de RIF inválida (debe tener entre 9 y 10 caracteres)' };
    }

    const prefijoChar = limpio.charAt(0);
    if (!PREFIJOS[prefijoChar]) {
        return { valido: false, error: `Prefijo inválido: ${prefijoChar}. Debe ser V, E, J, P, G o C.` };
    }

    // Extraer número y dígito verificador
    const digitoVerificadorEsperado = parseInt(limpio.slice(-1), 10);
    const numeroCuerpo = limpio.slice(1, -1).padStart(8, '0');

    if (isNaN(digitoVerificadorEsperado) || isNaN(parseInt(numeroCuerpo, 10))) {
        return { valido: false, error: 'El cuerpo y el dígito verificador deben ser numéricos' };
    }

    // Cálculo Módulo 11
    let suma = PREFIJOS[prefijoChar] * FACTORES[0];
    for (let i = 0; i < 8; i++) {
        suma += parseInt(numeroCuerpo[i], 10) * FACTORES[i + 1];
    }

    const resto = suma % 11;
    let digitoCalculado = 11 - resto;

    if (digitoCalculado >= 10) {
        digitoCalculado = 0;
    }

    if (digitoCalculado !== digitoVerificadorEsperado) {
        return {
            valido: false,
            error: `Dígito verificador inválido. Se esperaba ${digitoCalculado}, pero se ingresó ${digitoVerificadorEsperado}`,
            digitoCalculado
        };
    }

    return {
        valido: true,
        rifFormateado: `${prefijoChar}-${numeroCuerpo}-${digitoVerificadorEsperado}`,
        prefijo: prefijoChar,
        numero: numeroCuerpo,
        digito: digitoVerificadorEsperado
    };
}

module.exports = {
    validarRIF,
    normalizarRIF
};

