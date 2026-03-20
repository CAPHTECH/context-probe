import "package:flutter_heuristics/core/logger.dart";
import "package:flutter_heuristics/features/events/domain/event_repository.dart";
import "package:flutter_heuristics/features/events/domain/event_template.dart";

class SupabaseEventRepository implements EventRepository {
  SupabaseEventRepository(this.template);

  final EventTemplate template;

  @override
  Future<void> save(String id) async {
    logInfo("${template.name}:$id");
  }
}
