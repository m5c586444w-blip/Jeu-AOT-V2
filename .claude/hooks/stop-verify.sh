#!/usr/bin/env bash
# Hook Stop : lance `npm run verify` ; en cas d'échec, bloque l'arrêt (exit 2) pour que Claude corrige.
# Garde-fou anti-boucle : si l'arrêt a déjà été bloqué une fois (stop_hook_active=true), on laisse
# s'arrêter et on signale l'échec (règle « un critère échoue deux fois → arrêt »).
input="$(cat)"
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 0
[ -f package.json ] || exit 0
grep -q '"verify"' package.json || exit 0
[ -d node_modules ] || exit 0
out="$(npm run verify 2>&1)"; code=$?
[ $code -eq 0 ] && exit 0
active="$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).stop_hook_active===true)}catch{console.log(false)}})')"
{
  echo "npm run verify a échoué (code $code). Fin de la sortie :"
  printf '%s\n' "$out" | tail -40
} >&2
if [ "$active" = "true" ]; then
  echo "Second échec consécutif : arrêt autorisé. Consigne la raison dans docs/PROGRESS.md." >&2
  exit 0
fi
exit 2
