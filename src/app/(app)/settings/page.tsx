import { auth } from '@/auth';
import { prisma } from '@/server/prisma';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  return (
    <div className="container mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
      <Separator className="my-6" />
      <Card>
        <CardHeader>
          <CardTitle>Профиль</CardTitle>
          <CardDescription>Параметры аккаунта и предпочтения интерфейса.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-3 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Email</dt><dd className="col-span-2">{user.email}</dd>
            <dt className="text-muted-foreground">Имя</dt><dd className="col-span-2">{user.name ?? '—'}</dd>
            <dt className="text-muted-foreground">Часовой пояс</dt><dd className="col-span-2">{user.timezone}</dd>
            <dt className="text-muted-foreground">Язык</dt><dd className="col-span-2">{user.locale}</dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
