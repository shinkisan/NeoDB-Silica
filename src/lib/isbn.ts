export function normalizeIsbn(value: string) {
  const compact = value.replace(/[^0-9Xx]/g, "").toUpperCase();

  if (compact.length === 13 && isValidIsbn13(compact)) {
    return compact;
  }

  if (compact.length === 10 && isValidIsbn10(compact)) {
    return isbn10ToIsbn13(compact);
  }

  return "";
}

function isValidIsbn13(value: string) {
  if (!/^(978|979)\d{10}$/.test(value)) {
    return false;
  }

  const sum = value
    .slice(0, 12)
    .split("")
    .reduce((total, char, index) => {
      const digit = Number(char);
      return total + digit * (index % 2 === 0 ? 1 : 3);
    }, 0);
  const check = (10 - (sum % 10)) % 10;

  return check === Number(value[12]);
}

function isValidIsbn10(value: string) {
  if (!/^\d{9}[\dX]$/.test(value)) {
    return false;
  }

  const sum = value.split("").reduce((total, char, index) => {
    const digit = char === "X" ? 10 : Number(char);
    return total + digit * (10 - index);
  }, 0);

  return sum % 11 === 0;
}

function isbn10ToIsbn13(value: string) {
  const prefix = `978${value.slice(0, 9)}`;
  const sum = prefix.split("").reduce((total, char, index) => {
    const digit = Number(char);
    return total + digit * (index % 2 === 0 ? 1 : 3);
  }, 0);
  const check = (10 - (sum % 10)) % 10;

  return `${prefix}${check}`;
}
