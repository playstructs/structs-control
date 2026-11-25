// Hand-maintained until webapp regenerates protos against structsd v0.23.0.
// Proto: MsgSubstationUpdateConnectionCapacityMaximum (creator, substationId, connectionCapacityMaximum).

/* eslint-disable */
import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";

export interface MsgSubstationUpdateConnectionCapacityMaximum {
  creator: string;
  substationId: string;
  /** Zero removes the limit. Exact decimal string for uint64. */
  connectionCapacityMaximum: string;
}

function createBase(): MsgSubstationUpdateConnectionCapacityMaximum {
  return { creator: "", substationId: "", connectionCapacityMaximum: "0" };
}

export const MsgSubstationUpdateConnectionCapacityMaximum = {
  encode(
    message: MsgSubstationUpdateConnectionCapacityMaximum,
    writer: BinaryWriter = new BinaryWriter(),
  ): BinaryWriter {
    if (message.creator !== "") {
      writer.uint32(10).string(message.creator);
    }
    if (message.substationId !== "") {
      writer.uint32(18).string(message.substationId);
    }
    if (message.connectionCapacityMaximum !== "0") {
      writer.uint32(24).uint64(message.connectionCapacityMaximum);
    }
    return writer;
  },

  decode(input: BinaryReader | Uint8Array, length?: number): MsgSubstationUpdateConnectionCapacityMaximum {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === undefined ? reader.len : reader.pos + length;
    const message = createBase();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) break;
          message.creator = reader.string();
          continue;
        case 2:
          if (tag !== 18) break;
          message.substationId = reader.string();
          continue;
        case 3:
          if (tag !== 24) break;
          message.connectionCapacityMaximum = reader.uint64().toString();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) break;
      reader.skip(tag & 7);
    }
    return message;
  },

  fromPartial(object: {
    creator?: string;
    substationId?: string;
    connectionCapacityMaximum?: string;
  }): MsgSubstationUpdateConnectionCapacityMaximum {
    const message = createBase();
    message.creator = object.creator ?? "";
    message.substationId = object.substationId ?? "";
    message.connectionCapacityMaximum = object.connectionCapacityMaximum ?? "0";
    return message;
  },
};
