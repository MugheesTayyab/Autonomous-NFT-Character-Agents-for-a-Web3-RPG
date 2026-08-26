import { ethers } from "hardhat";

// Character roster calibrated for autonomous agent behaviors
const CHARACTERS = [
  {
    name: "Kael the Unbroken",
    archetype: 2, // BERSERKER
    traits: {
      riskTolerance: 95,
      trustBaseline: 15,
      aggression: 90,
      patience: 10,
    },
    metadataURI: "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/kael.json",
  },
  {
    name: "Lyra the Tactical",
    archetype: 1, // STRATEGIST
    traits: {
      riskTolerance: 30,
      trustBaseline: 80,
      aggression: 20,
      patience: 85,
    },
    metadataURI: "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/lyra.json",
  },
  {
    name: "Rexx the Scavenger",
    archetype: 0, // SCAVENGER
    traits: {
      riskTolerance: 70,
      trustBaseline: 25,
      aggression: 60,
      patience: 40,
    },
    metadataURI: "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/rexx.json",
  },
  {
    name: "Voss the Peacemaker",
    archetype: 3, // DIPLOMAT
    traits: {
      riskTolerance: 20,
      trustBaseline: 95,
      aggression: 5,
      patience: 90,
    },
    metadataURI: "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/voss.json",
  },
  {
    name: "Nyx the Shadow",
    archetype: 4, // HOARDER
    traits: {
      riskTolerance: 10,
      trustBaseline: 10,
      aggression: 15,
      patience: 95,
    },
    metadataURI: "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/nyx.json",
  },
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("----------------------------------------------------");
  console.log(`Starting character minting with deployer: ${deployer.address}`);

  const nftAddress = process.env.CHARACTER_NFT_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

  const CharacterNFTFactory = await ethers.getContractFactory("CharacterNFT");
  const nft = CharacterNFTFactory.attach(nftAddress);

  for (let i = 0; i < CHARACTERS.length; i++) {
    const char = CHARACTERS[i];
    console.log(`\nMinting [Token ID ${i}]: ${char.name}...`);

    const tx = await (nft as any).mintCharacter(
      deployer.address,
      char.name,
      char.archetype,
      char.traits,
      char.metadataURI
    );
    console.log(`Transaction sent: ${tx.hash}. Waiting for confirmation...`);
    const receipt = await tx.wait();
    console.log(`Confirmed in block: ${receipt.blockNumber}`);
  }

  console.log("\nAll 5 Autonomous RPG Characters minted successfully!");
  console.log("----------------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
