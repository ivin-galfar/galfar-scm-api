import { Processslafunctions } from "../helpers/SLAfunctions.js";

export const SLAController = async (result) => {
  const {
    logStatements = [],
    buyRentStatements = [],
    fileNotes = [],
    hireAsset = [],
  } = result;

  await Promise.allSettled([
    Processslafunctions(logStatements, "logistics"),
    Processslafunctions(buyRentStatements, "buyvsrent"),
    Processslafunctions(fileNotes, "filenote"),
    Processslafunctions(hireAsset, "hiringasset"),
  ]);
};
