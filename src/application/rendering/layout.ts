import { ValidationError } from '../../shared/errors.js';
import type {
  BulletinRenderModel,
  LayoutModeConfig,
  RenderPlan,
  RenderTemplateVersion,
} from './render-model.js';

export function createRenderPlan(
  model: BulletinRenderModel,
  template: RenderTemplateVersion,
): RenderPlan {
  const count = model.selections.length;
  const mode = selectLayoutMode(count, template.layoutModes);
  const requiredHeight =
    mode.cardHeight * count + mode.cardGap * Math.max(0, count - 1);
  if (requiredHeight > template.regions.selections.height) {
    throw new ValidationError('Render layout exceeds selection region');
  }

  const cards = model.selections.map((selection, index) => ({
    position: selection.position,
    x: template.regions.selections.x,
    y: template.regions.selections.y + index * (mode.cardHeight + mode.cardGap),
    width: template.regions.selections.width,
    height: mode.cardHeight,
  }));

  return {
    format: template.format,
    width: template.canvas.width,
    height: template.canvas.height,
    layoutMode: mode.id,
    cards,
    statusBoxes: cards.map((card) => ({
      position: card.position,
      x: card.x + card.width - 176,
      y: card.y + card.height - mode.cardPaddingY - 38,
      width: 134,
      height: 38,
    })),
  };
}

export function selectLayoutMode(
  selectionCount: number,
  modes: LayoutModeConfig[],
): LayoutModeConfig {
  const mode = modes.find(
    (item) =>
      selectionCount >= item.minSelections &&
      selectionCount <= item.maxSelections,
  );
  if (!mode) {
    throw new ValidationError('Selection count is not supported by template');
  }
  return mode;
}

export function validateRenderPlan(plan: RenderPlan): void {
  for (const card of plan.cards) {
    if (
      card.x < 0 ||
      card.y < 0 ||
      card.x + card.width > plan.width ||
      card.y + card.height > plan.height
    ) {
      throw new ValidationError('Render card exceeds canvas bounds');
    }
  }
  for (let index = 1; index < plan.cards.length; index += 1) {
    if (
      plan.cards[index].y <
      plan.cards[index - 1].y + plan.cards[index - 1].height
    ) {
      throw new ValidationError('Render cards overlap');
    }
  }
}
