export type CategoriaPeca =
  | "loucas"
  | "sousplats"
  | "tacas_copos"
  | "talheres"
  | "toalhas"
  | "guardanapos"
  | "decoracao"
  | "outros";

export type StatusEvento = "orcamento" | "confirmado" | "realizado" | "cancelado";
export type TipoParcela = "sinal" | "saldo" | "parcela" | "avista" | "avaria";
// "vencido" nunca é gravado: é derivado da data (ver statusEfetivo).
export type StatusParcela = "pendente" | "recebido" | "vencido";
export type TipoAvaria = "quebra" | "dano" | "perda";
export type CategoriaDespesa = "frete" | "reposicao" | "trafego_pago" | "aquisicao" | "outros";
export type MotivoMovimento = "cadastro" | "ajuste" | "aquisicao" | "reposicao" | "avaria";

export interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cpf_cnpj: string | null;
  endereco: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Peca {
  id: string;
  nome: string;
  categoria: CategoriaPeca;
  valor_reposicao: number | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// Linha da view pecas_estoque: a peça + o estoque calculado.
export interface PecaEstoque extends Peca {
  estoque: number;
}

export interface Disponibilidade {
  peca_id: string;
  estoque: number;
  reservado: number;
  disponivel: number;
}

export interface Evento {
  id: string;
  cliente_id: string;
  titulo: string;
  tipo_evento: string | null;
  data_evento: string;
  data_saida: string;
  data_retorno: string;
  local: string | null;
  convidados: number | null;
  valor_total: number;
  status: StatusEvento;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  clientes?: Cliente;
  evento_itens?: EventoItem[];
  parcelas?: Parcela[];
  avarias?: Avaria[];
}

export interface EventoItem {
  id: string;
  evento_id: string;
  peca_id: string;
  quantidade: number;
  pecas?: Peca;
}

export interface Parcela {
  id: string;
  evento_id: string;
  tipo: TipoParcela;
  valor: number;
  data_vencimento: string;
  data_recebimento: string | null;
  status: "pendente" | "recebido";
  avaria_id: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  eventos?: Evento;
}

export interface Avaria {
  id: string;
  evento_id: string;
  peca_id: string;
  quantidade: number;
  tipo: TipoAvaria;
  valor: number;
  data: string;
  vencimento: string;
  observacoes: string | null;
  created_at: string;
  pecas?: Peca;
}

export interface Despesa {
  id: string;
  data: string;
  valor: number;
  categoria: CategoriaDespesa;
  descricao: string;
  evento_id: string | null;
  peca_id: string | null;
  quantidade_pecas: number | null;
  created_at: string;
  updated_at: string;
  eventos?: Pick<Evento, "id" | "titulo"> | null;
  pecas?: Pick<Peca, "id" | "nome"> | null;
}

export interface MovimentoAcervo {
  id: string;
  peca_id: string;
  delta: number;
  motivo: MotivoMovimento;
  data: string;
  despesa_id: string | null;
  avaria_id: string | null;
  observacao: string | null;
  created_at: string;
}

export const CATEGORIAS_PECA: Record<CategoriaPeca, string> = {
  loucas: "Louças",
  sousplats: "Sousplats",
  tacas_copos: "Taças e copos",
  talheres: "Talheres",
  toalhas: "Toalhas",
  guardanapos: "Guardanapos",
  decoracao: "Decoração",
  outros: "Outros",
};

export const STATUS_EVENTO: Record<StatusEvento, string> = {
  orcamento: "Orçamento",
  confirmado: "Confirmado",
  realizado: "Realizado",
  cancelado: "Cancelado",
};

export const TIPOS_PARCELA: Record<TipoParcela, string> = {
  sinal: "Sinal",
  saldo: "Saldo",
  parcela: "Parcela",
  avista: "À vista",
  avaria: "Avaria",
};

export const STATUS_PARCELA: Record<StatusParcela, string> = {
  pendente: "Pendente",
  recebido: "Recebido",
  vencido: "Vencido",
};

export const TIPOS_AVARIA: Record<TipoAvaria, string> = {
  quebra: "Quebra",
  dano: "Dano",
  perda: "Perda",
};

export const CATEGORIAS_DESPESA: Record<CategoriaDespesa, string> = {
  frete: "Frete",
  reposicao: "Reposição de peças",
  trafego_pago: "Tráfego pago",
  aquisicao: "Aquisição de peças",
  outros: "Outros",
};

// Categorias de despesa em que a compra pode entrar no acervo.
export const CATEGORIAS_COM_PECA: CategoriaDespesa[] = ["reposicao", "aquisicao"];

export const MOTIVOS_MOVIMENTO: Record<MotivoMovimento, string> = {
  cadastro: "Cadastro",
  ajuste: "Ajuste manual",
  aquisicao: "Aquisição",
  reposicao: "Reposição",
  avaria: "Avaria",
};

// Status em que o evento segura as peças do acervo.
export const STATUS_QUE_RESERVAM: StatusEvento[] = ["confirmado", "realizado"];

// Quantos dias depois do evento as peças voltam a ficar livres
// (retorno + lavagem). Preenche o padrão do formulário; cada evento
// pode ter as próprias datas.
export const DIAS_RETORNO_PADRAO = 3;
