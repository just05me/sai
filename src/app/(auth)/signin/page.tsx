import { redirect } from 'next/navigation';

/** Selfhost 1.0: вход не требуется — сразу на рабочий стол. */
export default function SignInPage() {
  redirect('/workspace');
}
