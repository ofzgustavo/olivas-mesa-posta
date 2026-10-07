import type { Config } from "tailwindcss";

// Lê um token de src/app/globals.css (triplas RGB em `--oliva`, `--areia`
// etc.) e devolve uma cor Tailwind que ainda aceita modificador de
// opacidade (`bg-oliva/10`). Trocar a cor da marca é trocar o valor da
// variável, sem tocar em nenhum componente.
function token(variavel: string) {
  return `rgb(var(${variavel}) / <alpha-value>)`;
}

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        oliva: {
          DEFAULT: token("--oliva"),
          claro: token("--oliva-claro"),
          escuro: token("--oliva-escuro"),
        },
        areia: {
          DEFAULT: token("--areia"),
          claro: token("--areia-claro"),
          escuro: token("--areia-escuro"),
        },
        fundo: token("--fundo"),
        cinza: token("--cinza"),
        tinta: token("--tinta"),
      },
      fontFamily: {
        titulo: ["Cormorant Garamond", "Georgia", "serif"],
        corpo: ["Lato", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
