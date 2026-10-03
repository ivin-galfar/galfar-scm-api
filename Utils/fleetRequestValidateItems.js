const YES_NO_VALUES = new Set(["yes", "no"]);
const TPI_VALUES = new Set(["normal", "cpis"]);

export const hasInvalidFitmentSelection = (items) => {
  items.some((item) => {
    const adnocFitments = String(item?.adnoc_fitments ?? "")
      .trim()
      .toLowerCase();
    const tpi = String(item?.tpi ?? "")
      .trim()
      .toLowerCase();

    return !YES_NO_VALUES.has(adnocFitments) || !TPI_VALUES.has(tpi);
  });
};
