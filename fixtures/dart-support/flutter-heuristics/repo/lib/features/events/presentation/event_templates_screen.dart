import "package:flutter/material.dart";
import "package:flutter_heuristics/features/events/domain/event_template.dart";

class EventTemplatesScreen extends StatelessWidget {
  const EventTemplatesScreen({super.key, required this.template});

  final EventTemplate template;

  @override
  Widget build(BuildContext context) {
    return Text(template.name, textDirection: TextDirection.ltr);
  }
}
