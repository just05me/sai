import { PROMPTS } from './prompts';

export const PERSONAS = [
  { id: 'investor', label: 'Investor', system: PROMPTS.persona.investor },
  { id: 'devilsAdvocate', label: "Devil's Advocate", system: PROMPTS.persona.devilsAdvocate },
  { id: 'customer', label: 'Customer', system: PROMPTS.persona.customer },
  { id: 'architect', label: 'Architect', system: PROMPTS.persona.architect },
  { id: 'mentor', label: 'Mentor', system: PROMPTS.persona.mentor },
] as const;

export type PersonaId = typeof PERSONAS[number]['id'];

export function personaSystem(id: PersonaId | undefined): string {
  if (!id) return 'You are a helpful product assistant for the Sai app.';
  return PERSONAS.find((p) => p.id === id)?.system ?? PROMPTS.persona.mentor;
}
