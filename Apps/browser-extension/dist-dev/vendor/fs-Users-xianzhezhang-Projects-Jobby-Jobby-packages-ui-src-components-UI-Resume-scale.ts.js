export function scaleResumeTemplate(config, scale) {
  const scaled = (value) => value * scale;
  return {
    ...config,
    paper: {
      ...config.paper,
      paddingTop: scaled(config.paper.paddingTop),
      paddingRight: scaled(config.paper.paddingRight),
      paddingBottom: scaled(config.paper.paddingBottom),
      paddingLeft: scaled(config.paper.paddingLeft)
    },
    typography: {
      ...config.typography,
      bodySize: scaled(config.typography.bodySize),
      nameSize: scaled(config.typography.nameSize),
      headlineSize: scaled(config.typography.headlineSize),
      contactSize: scaled(config.typography.contactSize),
      sectionTitleSize: scaled(config.typography.sectionTitleSize),
      dateSize: scaled(config.typography.dateSize),
      metaSize: scaled(config.typography.metaSize),
      urlSize: scaled(config.typography.urlSize),
      footerSize: scaled(config.typography.footerSize)
    },
    spacing: {
      headerPaddingBottom: scaled(config.spacing.headerPaddingBottom),
      headerRuleWidth: scaled(config.spacing.headerRuleWidth),
      headlineGap: scaled(config.spacing.headlineGap),
      contactGap: scaled(config.spacing.contactGap),
      sectionGap: scaled(config.spacing.sectionGap),
      sectionTitlePadding: scaled(config.spacing.sectionTitlePadding),
      sectionRuleWidth: scaled(config.spacing.sectionRuleWidth),
      entryGap: scaled(config.spacing.entryGap),
      rowGap: scaled(config.spacing.rowGap),
      detailGap: scaled(config.spacing.detailGap),
      bulletGap: scaled(config.spacing.bulletGap),
      bulletMarkWidth: scaled(config.spacing.bulletMarkWidth),
      bulletIndent: config.spacing.bulletIndent ? scaled(config.spacing.bulletIndent) : void 0,
      technologyGap: scaled(config.spacing.technologyGap),
      skillGap: scaled(config.spacing.skillGap),
      contentInset: scaled(config.spacing.contentInset),
      skillLabelWidth: scaled(config.spacing.skillLabelWidth),
      footerBottom: scaled(config.spacing.footerBottom),
      footerInset: scaled(config.spacing.footerInset)
    }
  };
}
export function clampSmartScale(config, scale) {
  return Math.min(
    config.smartOnePage.maxScale,
    Math.max(config.smartOnePage.minScale, scale)
  );
}
