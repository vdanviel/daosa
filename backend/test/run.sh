#!/usr/bin/env bash
set -euo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$TEST_DIR/.." && pwd)"

usage() {
	cat <<EOF
Uso:
  $0 <categoria> [arquivo] [opções]

Categorias:
  unit | feature | e2e   roda só essa categoria
  all                    roda unit, feature e e2e em sequência (não aceita arquivo)

Arquivo (opcional):
  Nome do arquivo de teste, sem caminho. O sufixo .test.js é completado
  automaticamente. O arquivo é procurado dentro de test/<categoria>/.

Opções:
  -t, --test <texto>    Filtra pelo nome do teste (describe + it) usando TEXTO LITERAL.
                        Caracteres especiais (/ . * ( ) etc.) são escapados sozinhos.
                        Casa com qualquer parte do nome completo.
  -r, --regex <regex>   Filtra pelo nome do teste usando REGEX (para casos avançados).
  -v, --verbose         Mostra o nome de cada teste (útil para descobrir o texto do filtro).
  -h, --help            Mostra esta ajuda.

O nome completo de um teste é a junção dos describe + it separados por espaço.
Exemplo: describe('/v1/agent/register') + it('create agent')
         => "/v1/agent/register create agent"

Exemplos:
  $0 unit                                         # todos os testes unit
  $0 feature agent.feature                        # um arquivo inteiro
  $0 feature agent.feature.test.js                # igual ao anterior
  $0 feature agent.feature -t 'create agent'      # um teste específico (literal)
  $0 feature agent.feature -t 'register create'   # filtra por trecho do nome
  $0 unit Util -r 'isValidDocument.*CPF v[aá]lido'  # filtro com regex
  $0 feature -t 'retorna 401'                     # filtra em todos os arquivos feature
  $0 feature agent.feature -v                     # lista os nomes dos testes
  $0 all                                          # tudo

Compatibilidade: um 3º argumento posicional (sem flag) é tratado como --regex.
EOF
	exit "${1:-1}"
}

die() {
	echo "Erro: $*" >&2
	echo "Use '$0 --help' para ver os exemplos." >&2
	exit 1
}

# Escapa caracteres especiais de regex para um filtro literal.
escape_regex() {
	printf '%s' "$1" | sed 's/[][\\.*^$+?(){}|]/\\&/g'
}

literal_filter=""
regex_filter=""
verbose=0
positional=()

while [[ $# -gt 0 ]]; do
	case "$1" in
		-h|--help) usage 0 ;;
		-t|--test)
			[[ $# -ge 2 ]] || die "$1 precisa de um valor."
			literal_filter="$2"
			shift 2
			;;
		-r|--regex)
			[[ $# -ge 2 ]] || die "$1 precisa de um valor."
			regex_filter="$2"
			shift 2
			;;
		-v|--verbose) verbose=1; shift ;;
		-*) die "Opção desconhecida: $1" ;;
		*) positional+=("$1"); shift ;;
	esac
done

[[ ${#positional[@]} -ge 1 ]] || usage
[[ ${#positional[@]} -le 3 ]] || die "Argumentos demais."

category="${positional[0]}"
test_name="${positional[1]:-}"

# Compatibilidade com o formato antigo: 3º argumento posicional = regex.
if [[ ${#positional[@]} -eq 3 ]]; then
	[[ -z "$regex_filter" ]] || die "Use apenas um filtro (3º argumento ou --regex)."
	regex_filter="${positional[2]}"
fi

[[ -z "$literal_filter" || -z "$regex_filter" ]] || die "Use apenas um filtro: --test ou --regex."

case "$category" in
	unit|feature|e2e) categories=("$category") ;;
	all) categories=(unit feature e2e) ;;
	*) die "Categoria inválida: '$category' (use unit, feature, e2e ou all)." ;;
esac

if [[ -n "$test_name" ]]; then
	[[ "$category" != "all" ]] || die "Para um arquivo específico, informe unit, feature ou e2e."
	# Se o nome já tem extensão .js (ex: login.spec.js), usa como está.
	# Caso contrário, completa com .test.js (convenção de unit/feature).
	[[ "$test_name" == *.js ]] || test_name="${test_name}.test.js"
	# Aceita apenas o nome do arquivo, não um caminho.
	[[ "$(basename "$test_name")" == "$test_name" ]] || die "Informe só o nome do arquivo, sem caminho."
fi

if [[ -n "$literal_filter" ]]; then
	test_pattern="$(escape_regex "$literal_filter")"
else
	test_pattern="$regex_filter"
fi

vitest_args=(run --maxWorkers=1 --no-file-parallelism)
if [[ -n "$test_pattern" ]]; then
	vitest_args+=(--testNamePattern "$test_pattern")
fi
if [[ "$verbose" -eq 1 ]]; then
	vitest_args+=(--reporter=verbose)
fi

cd "$BACKEND_DIR"
for type in "${categories[@]}"; do
	category_dir="$TEST_DIR/$type"
	[[ -d "$category_dir" ]] || die "Diretório de testes não encontrado: $category_dir"

	if [[ "$type" == "e2e" ]]; then
		# Testes e2e usam Playwright, não Vitest.
		playwright_args=(test)
		if [[ -n "$test_pattern" ]]; then
			playwright_args+=(--grep "$test_pattern")
		fi
		if [[ "$verbose" -eq 1 ]]; then
			playwright_args+=(--reporter=list)
		fi
		if [[ -n "$test_name" ]]; then
			test_file="$(find "$category_dir" -type f -name "$test_name" -print -quit)"
			[[ -n "$test_file" ]] || die "Teste não encontrado em $type: $test_name"
			npx playwright test "${playwright_args[@]}" "$test_file"
		else
			npx playwright test "${playwright_args[@]}" "$category_dir"
		fi
	else
		if [[ -n "$test_name" ]]; then
			test_file="$(find "$category_dir" -type f -name "$test_name" -print -quit)"
			[[ -n "$test_file" ]] || die "Teste não encontrado em $type: $test_name"
			npx vitest "${vitest_args[@]}" "$test_file"
		else
			npx vitest "${vitest_args[@]}" "$category_dir"
		fi
	fi
done