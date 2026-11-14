export type ZernioAccount = { id: string; username: string; igUserId: string | null; picture: string | null };

/** Conta Instagram ativa na Zernio. Com mais de uma, exige accountId (ZERNIO_ACCOUNT_ID). */
export async function zernioAccount(apiKey: string, accountId?: string): Promise<ZernioAccount> {
  const res = await fetch("https://zernio.com/api/v1/accounts", { headers: { Authorization: `Bearer ${apiKey}` } });
  if (res.status === 401 || res.status === 403) throw new Error("A Zernio recusou a chave: confira a ZERNIO_API_KEY (precisa de leitura e escrita)");
  if (!res.ok) throw new Error(`Zernio respondeu ${res.status} em GET /v1/accounts`);
  const { accounts } = (await res.json()) as {
    accounts: { _id: string; platform: string; username: string; isActive: boolean; platformUserId?: string; profilePicture?: string }[];
  };
  const ig = accounts.filter((a) => a.platform === "instagram" && a.isActive);
  const chosen = accountId ? ig.find((a) => a._id === accountId) : ig.length === 1 ? ig[0] : undefined;
  if (!chosen) {
    const list = ig.map((a) => `  @${a.username}: ${a._id}`).join("\n");
    throw new Error(
      ig.length === 0
        ? "Nenhuma conta Instagram ativa na Zernio: conecte uma no painel da Zernio"
        : accountId
          ? `ZERNIO_ACCOUNT_ID não bate com nenhuma conta Instagram ativa. Contas:\n${list}`
          : `Mais de uma conta Instagram na Zernio: escolha uma e informe o ID (ZERNIO_ACCOUNT_ID):\n${list}`,
    );
  }
  return { id: chosen._id, username: chosen.username, igUserId: chosen.platformUserId ?? null, picture: chosen.profilePicture ?? null };
}
