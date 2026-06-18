import React from "react";
import type { BaseMultiplayerMessage } from "./messages";
import { OnlineGameSetup } from "./OnlineGameSetup";
import type { OnlineGameSetupProps } from "./OnlineGameSetup";

export type MultiplayerPanelProps<TGameMessage extends BaseMultiplayerMessage = BaseMultiplayerMessage> = Omit<
  OnlineGameSetupProps<TGameMessage>,
  "minPlayers" | "maxPlayers"
> & {
  minPlayers?: number;
  maxPlayers?: number;
};

export function MultiplayerPanel<TGameMessage extends BaseMultiplayerMessage = BaseMultiplayerMessage>({
  minPlayers = 2,
  maxPlayers = 2,
  ...props
}: MultiplayerPanelProps<TGameMessage>): React.ReactElement {
  return <OnlineGameSetup minPlayers={minPlayers} maxPlayers={maxPlayers} {...props} />;
}

export default MultiplayerPanel;
