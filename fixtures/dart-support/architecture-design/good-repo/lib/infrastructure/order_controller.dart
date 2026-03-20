import "../application/load_order.dart";
import "../contracts/order_contract.dart";

String handleOrder(String id) => loadOrder(OrderContract(id));

