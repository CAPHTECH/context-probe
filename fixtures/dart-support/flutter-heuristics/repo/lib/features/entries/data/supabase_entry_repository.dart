import "package:flutter_heuristics/core/logger.dart";
import "package:flutter_heuristics/features/entries/domain/entry.dart";
import "package:flutter_heuristics/features/entries/domain/entry_repository.dart";

class SupabaseEntryRepository implements EntryRepository {
  @override
  Future<Entry?> findById(String id) async {
    logInfo(id);
    return Entry(id);
  }
}
