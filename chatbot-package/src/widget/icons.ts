import {
  Bot,
  MessageCircle,
  SendHorizontal,
  UserRound,
  X,
  Plus,
  CheckCircle,
  ArrowLeft,
  createIcons,
} from 'lucide'

export const hydrateIcons = (): void => {
  createIcons({
    icons: {
      Bot,
      MessageCircle,
      SendHorizontal,
      UserRound,
      X,
      Plus,
      CheckCircle,
      ArrowLeft,
    },
  })
}
