abstract interface class EntryRepository {
  Future<Entry?> findById(String id);
}
