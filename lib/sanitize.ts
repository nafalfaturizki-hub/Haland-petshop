export function sanitizeText(input: string, maxLen = 2000): string {
  if (!input) return '';
  return input
    .replace(/[<>&"']/g, (c) => ({ '<': '<', '>': '>', '&': '&', '"': '"', "'": ''' })[c])
    .slice(0, maxLen);
}

export function sanitizeHtml(input: string): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, ''');
}

export function stripHtml(input: string): string {
  if (!input) return '';
  return input.replace(/<[^>]*>/g, '').trim();
}