import { Storage, Context, generateEvent } from '@massa/massa-as-sdk';

export class MultiSigChronoSwap {
  private static OWNERS: string[] = [
    "AU12...owner1",
    "AU12...owner2", 
    "AU12...owner3",
    "AU12...owner4",
    "AU12...owner5"
  ];
  private static REQUIRED_CONFIRMATIONS: u32 = 3;
  private static UPGRADE_DELAY: u64 = 48 * 60 * 60 * 1000; // 48 hours

  static proposeUpgrade(newCodeHash: string, description: string): string {
    const caller = Context.caller().toString();
    this._validateOwner(caller);

    const proposalId = this._generateProposalId(newCodeHash);
    
    const proposal = {
      id: proposalId,
      newCodeHash: newCodeHash,
      proposer: caller,
      description: description,
      proposedAt: Context.timestamp(),
      executableAfter: Context.timestamp() + this.UPGRADE_DELAY,
      confirmedBy: [caller]
    };

    Storage.set(`proposal_${proposalId}`, proposal);
    Storage.set(`confirmations_${proposalId}`, JSON.stringify([caller]));

    generateEvent(`Upgrade proposed: ${proposalId} by ${caller}`);
    return proposalId;
  }

  static confirmUpgrade(proposalId: string): void {
    const caller = Context.caller().toString();
    this._validateOwner(caller);

    const confirmationsJson = Storage.get(`confirmations_${proposalId}`);
    if (!confirmationsJson) {
      throw new Error("Proposal not found");
    }

    const confirmations: string[] = JSON.parse(confirmationsJson);
    if (confirmations.includes(caller)) {
      throw new Error("Already confirmed");
    }

    confirmations.push(caller);
    Storage.set(`confirmations_${proposalId}`, JSON.stringify(confirmations));

    if (confirmations.length >= this.REQUIRED_CONFIRMATIONS) {
      generateEvent(`Upgrade ${proposalId} has sufficient confirmations`);
    }

    generateEvent(`Upgrade confirmed by ${caller}`);
  }

  private static _validateOwner(address: string): void {
    if (!this.OWNERS.includes(address)) {
      throw new Error("Not an owner");
    }
  }

  private static _generateProposalId(newCodeHash: string): string {
    return `proposal_${Context.timestamp()}_${newCodeHash.substring(0, 8)}`;
  }
}