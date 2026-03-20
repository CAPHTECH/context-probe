import "../application/load_order.dart";
import "../internal/order_entity.dart";

String handleOrder(String id) => loadOrder(OrderEntity(id));
