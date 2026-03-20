import "../infrastructure/logger.dart";
import "../internal/order_entity.dart";

class OrderContract {
  final dynamic payload;
  final OrderEntity entity;

  OrderContract(this.payload, this.entity);
}

OrderEntity normalizeOrder(dynamic input) {
  logInfo("$input");
  return OrderEntity("$input");
}

