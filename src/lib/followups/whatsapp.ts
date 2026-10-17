// wa.me links open WhatsApp (app or web) with the message typed in; the
// staff member still presses send, so nothing goes out automatically.

/** Normalises a Syrian number to international digits: 0930 513 950 -> 963930513950. */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `963${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith("9")) digits = `963${digits}`;
  return digits.length >= 10 ? digits : null;
}

export function whatsAppLink(phone: string | null | undefined, text: string): string | null {
  const number = toWhatsAppNumber(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}

export function telLink(phone: string | null | undefined): string | null {
  const number = toWhatsAppNumber(phone);
  return number ? `tel:+${number}` : null;
}
