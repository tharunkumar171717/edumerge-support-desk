import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute, type Sequelize } from "sequelize";
import type { TicketModel } from "./ticket.model";

/** support_desk.notifications: in-app notifications, one row per recipient. */
export class NotificationModel extends Model<InferAttributes<NotificationModel>, InferCreationAttributes<NotificationModel>> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare ticketId: number | null;
  declare message: string;
  declare isRead: CreationOptional<boolean>;
  declare createdAt: Date;

  declare ticket?: NonAttribute<TicketModel | null>;

  static initModel(sequelize: Sequelize) {
    return NotificationModel.init(
      {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: DataTypes.INTEGER, allowNull: false },
        ticketId: { type: DataTypes.INTEGER },
        message: { type: DataTypes.TEXT, allowNull: false },
        isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        createdAt: { type: DataTypes.DATE, allowNull: false },
      },
      { sequelize, tableName: "notifications" },
    );
  }
}
