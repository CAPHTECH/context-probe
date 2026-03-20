import "../infrastructure/logger.dart";
import "../internal/order_entity.dart";

String loadOrder(OrderEntity entity) {
  logInfo(entity.id);
  return entity.id;
}

