import type { Pack } from "../types";
import { portfolioHeaderSummary } from "./header";
import { PORTFOLIO_ADDENDUM, PORTFOLIO_PERSONA } from "./prompt";
import { portfolioDataTools } from "./tools";

export const portfolioPack: Pack = {
  id: "portfolio",
  name: "Portfolio analyst",
  description: "NY taxable municipal SMA — chat-driven portfolio analysis.",
  agentPersona: PORTFOLIO_PERSONA,
  promptAddendum: PORTFOLIO_ADDENDUM,
  samplePrompts: [
    {
      label: "Raise cash",
      prompt:
        "I need to raise $10M in cash this week without spiking duration or credit risk. Walk me through what you'd sell — and whether we can lean on tax-loss positions to soften the hit.",
    },
    {
      label: "Concentration check",
      prompt:
        "Transportation is pushing 27% of the book across MTA, Port Authority, Triborough, NJ Transit, and the toll roads. Show me where it's concentrated and what you'd trim.",
    },
    {
      label: "Rate shock",
      prompt:
        "If the long end backs up 100bps, which positions take the biggest hit? Show me the damage and where we're most exposed.",
    },
    {
      label: "Watchlist names",
      prompt:
        "Four of our A-rated names are on negative outlook — PA Turnpike, Illinois GO, WA Healthcare, NY Liberty Housing. Are we being paid enough yield to keep holding them, or should we move up in quality?",
    },
    {
      label: "NY tax pickup",
      prompt:
        "We're sitting at 67% NY — well above the 50% floor. Is the in-state tax pickup actually worth that much concentration, or should we add out-of-state diversification?",
    },
    {
      label: "Reinvest",
      prompt:
        "$5M from a called bond just hit the account. Where would you put it to work given how the book is positioned today — and what sectors would you avoid adding to?",
    },
  ],
  dataTools: portfolioDataTools,
  headerSummary: portfolioHeaderSummary,
};
