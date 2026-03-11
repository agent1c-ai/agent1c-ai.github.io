const SOLANA_RPC_URL_DEFAULT = "https://api.mainnet-beta.solana.com"
const SOLANA_RPC_URL_FALLBACKS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
  "https://rpc.ankr.com/solana",
]

function cleanAddress(value){
  return String(value || "").trim()
}

function asNumber(value, fallback = 0){
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

async function rpcRequest(method, params, rpcUrl = SOLANA_RPC_URL_DEFAULT){
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      method,
      params,
    }),
  })
  const json = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`Solana RPC failed (${response.status})`)
  }
  if (json?.error) {
    const message = String(json.error?.message || json.error || "Unknown Solana RPC error").trim()
    throw new Error(message || "Unknown Solana RPC error")
  }
  return json?.result
}

function rpcCandidates(preferred){
  const first = cleanAddress(preferred)
  const urls = [first, ...SOLANA_RPC_URL_FALLBACKS].filter(Boolean)
  return Array.from(new Set(urls))
}

function solFromLamports(lamports){
  return asNumber(lamports, 0) / 1_000_000_000
}

function findAccountIndex(address, accountKeys){
  const needle = cleanAddress(address)
  if (!needle || !Array.isArray(accountKeys)) return -1
  for (let i = 0; i < accountKeys.length; i += 1) {
    const item = accountKeys[i]
    const key = cleanAddress(item?.pubkey || item)
    if (key === needle) return i
  }
  return -1
}

function normalizeTransactionSummary(address, tx){
  const signature = cleanAddress(tx?.transaction?.signatures?.[0] || tx?.signature)
  const slot = asNumber(tx?.slot, 0)
  const blockTime = asNumber(tx?.blockTime, 0)
  const meta = tx?.meta || {}
  const message = tx?.transaction?.message || {}
  const accountKeys = Array.isArray(message?.accountKeys) ? message.accountKeys : []
  const walletIndex = findAccountIndex(address, accountKeys)
  const preBalances = Array.isArray(meta?.preBalances) ? meta.preBalances : []
  const postBalances = Array.isArray(meta?.postBalances) ? meta.postBalances : []
  const err = meta?.err || null
  const confirmationStatus = String(tx?.confirmationStatus || "").trim() || (err ? "failed" : "confirmed")
  const netLamports = walletIndex >= 0
    ? asNumber(postBalances[walletIndex], 0) - asNumber(preBalances[walletIndex], 0)
    : 0
  return {
    signature,
    slot,
    blockTime: blockTime ? new Date(blockTime * 1000).toISOString() : "",
    confirmationStatus,
    ok: !err,
    err,
    memo: String(tx?.memo || "").trim(),
    netLamports,
    netSol: solFromLamports(netLamports),
  }
}

export async function fetchSolanaWalletSnapshot(address, options = {}){
  const walletAddress = cleanAddress(address)
  if (!walletAddress) throw new Error("Missing Solana wallet address")
  const rpcUrl = cleanAddress(options.rpcUrl) || SOLANA_RPC_URL_DEFAULT
  const txLimit = Math.max(1, Math.min(10, asNumber(options.txLimit, 5)))
  let lastError = null

  for (const candidate of rpcCandidates(rpcUrl)) {
    try {
      const [balanceResult, signatureResults] = await Promise.all([
        rpcRequest("getBalance", [walletAddress, { commitment: "confirmed" }], candidate),
        rpcRequest("getSignaturesForAddress", [walletAddress, { limit: txLimit }], candidate),
      ])

      const lamports = asNumber(balanceResult?.value, 0)
      const signatures = Array.isArray(signatureResults) ? signatureResults : []
      const detailed = await Promise.all(
        signatures.map(async (item) => {
          const signature = cleanAddress(item?.signature)
          if (!signature) return null
          try {
            const tx = await rpcRequest("getTransaction", [signature, {
              commitment: "confirmed",
              encoding: "jsonParsed",
              maxSupportedTransactionVersion: 0,
            }], candidate)
            if (tx) return normalizeTransactionSummary(walletAddress, tx)
          } catch {}
          return {
            signature,
            slot: asNumber(item?.slot, 0),
            blockTime: asNumber(item?.blockTime, 0) ? new Date(asNumber(item.blockTime, 0) * 1000).toISOString() : "",
            confirmationStatus: String(item?.confirmationStatus || "").trim() || "confirmed",
            ok: !item?.err,
            err: item?.err || null,
            memo: String(item?.memo || "").trim(),
            netLamports: 0,
            netSol: 0,
          }
        }),
      )

      return {
        address: walletAddress,
        chain: "solana",
        lamports,
        balanceSol: solFromLamports(lamports),
        fetchedAt: new Date().toISOString(),
        rpcSource: candidate,
        recentTransactions: detailed.filter(Boolean),
      }
    } catch (err) {
      lastError = err
    }
  }

  throw (lastError instanceof Error ? lastError : new Error("Wallet refresh failed"))
}
