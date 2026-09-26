import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute, type Sequelize } from "sequelize";
import type { UserModel } from "./user.model";

/** support_desk.ticket_events: append-only audit trail (actorId null = the system). */
export class TicketEventModel extends Model<InferAttributes<TicketEventModel>, InferCreationAttributes<TicketEventModel>> {
  declare id: CreationOptional<number>;
  declare ticketId: number;
  declare actorId: number | null;
  declare kind: string;
  declare fromValue: string | null;
  declare toValue: string | null;
  declare note: string | null;
  declare createdAt: Date;

  declare actor?: NonAttribute<UserModel | null>;

  static initModel(sequelize: Sequelize) {
    return TicketEventModel.init(
      {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        ticketId: { type: DataTypes.INTEGER, allowNull: false },
        actorId: { type: DataTypes.INTEGER },
        kind: { type: DataTypes.TEXT, allowNull: false },
        fromValue: { type: DataTypes.TEXT },
        toValue: { type: DataTypes.TEXT },
        note: { type: DataTypes.TEXT },
        createdAt: { type: DataTypes.DATE, allowNull: false },
      },
      { sequelize, tableName: "ticket_events" },
    );
  }
}
