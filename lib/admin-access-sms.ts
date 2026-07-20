const netgsmSingleSmsLimit = 155;

export function buildAdminAccessSms({
  loginUrl,
  email,
  password,
}: {
  loginUrl: string;
  email: string;
  password: string;
}) {
  const fullMessage = `Bonj panel: ${loginUrl} E-posta: ${email} Sifre: ${password} Ilk giriste sifrenizi degistirin.`;
  if (fullMessage.length <= netgsmSingleSmsLimit) return fullMessage;

  const compactMessage = `Bonj panel: ${loginUrl} E-posta: ${email} Sifre: ${password}`;
  if (compactMessage.length <= netgsmSingleSmsLimit) return compactMessage;

  throw new Error(
    "Giriş bilgileri tek SMS sınırını aşıyor. Kullanıcının e-posta adresini kısaltın.",
  );
}
