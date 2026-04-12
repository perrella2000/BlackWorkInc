import 'package:flutter/material.dart';
import 'package:swipe_cards/swipe_cards.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final List<SwipeItem> _swipeItems = [];
  MatchEngine? _matchEngine;

  @override
  void initState() {
    super.initState();
    _loadJobs();
  }

  void _loadJobs() {
    final dummyJobs = [
      {"title": "Грузчик на склад", "salary": "3000 ₽ / смена", "icon": "📦", "dist": "1.2 км"},
      {"title": "Разнорабочий", "salary": "2500 ₽ / смена", "icon": "🧱", "dist": "3.5 км"},
      {"title": "Помощник повара", "salary": "3500 ₽ / смена", "icon": "🍲", "dist": "0.8 км"},
    ];

    for (var job in dummyJobs) {
      _swipeItems.add(SwipeItem(
        content: job,
        likeAction: () {},
        nopeAction: () {},
      ));
    }
    _matchEngine = MatchEngine(swipeItems: _swipeItems);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Вакансии рядом'),
        actions: [
          IconButton(icon: const Icon(Icons.person), onPressed: () {}),
          IconButton(icon: const Icon(Icons.chat), onPressed: () {})
        ],
      ),
      body: Center(
        child: SizedBox(
          height: 500,
          child: _matchEngine != null
              ? SwipeCards(
                  matchEngine: _matchEngine!,
                  itemBuilder: (BuildContext context, int index) {
                    final job = _swipeItems[index].content;
                    return Card(
                      elevation: 4,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      child: Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          color: Colors.white,
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(job["icon"], style: const TextStyle(fontSize: 80)),
                            const SizedBox(height: 20),
                            Text(job["title"], style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 10),
                            Text(job["salary"], style: const TextStyle(fontSize: 32, color: Colors.green, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 10),
                            Text("📍 ${job["dist"]}", style: const TextStyle(fontSize: 18, color: Colors.grey)),
                          ],
                        ),
                      ),
                    );
                  },
                  onStackFinished: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Вакансии закончились')),
                    );
                  },
                )
              : const CircularProgressIndicator(),
        ),
      ),
      bottomNavigationBar: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            FloatingActionButton(
              heroTag: "btn1",
              backgroundColor: Colors.red,
              onPressed: () => _matchEngine?.currentItem?.nope(),
              child: const Icon(Icons.close, size: 30),
            ),
            FloatingActionButton(
              heroTag: "btn2",
              backgroundColor: Colors.green,
              onPressed: () => _matchEngine?.currentItem?.like(),
              child: const Icon(Icons.check, size: 30),
            )
          ],
        ),
      ),
    );
  }
}
