// heavy_feature.dart - Example of deferred loading implementation
import 'package:flutter/material.dart';

class HeavyFeatureWidget extends StatefulWidget {
  const HeavyFeatureWidget({super.key});

  @override
  State<HeavyFeatureWidget> createState() => _HeavyFeatureWidgetState();
}

class _HeavyFeatureWidgetState extends State<HeavyFeatureWidget>
    with TickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    );
    _fadeAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeInOut,
    ));
    
    _animationController.forward();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Heavy Feature'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: FadeTransition(
        opacity: _fadeAnimation,
        child: Container(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.rocket_launch,
                size: 80,
                color: Colors.blue,
              ),
              const SizedBox(height: 20),
              Text(
                'Heavy Feature Loaded!',
                style: Theme.of(context).textTheme.headlineMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              const Text(
                'This feature was loaded on-demand using deferred imports, '
                'which helps reduce the initial bundle size and improves startup performance.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),
              _buildFeatureDemo(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFeatureDemo() {
    return Card(
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            const Text(
              'Feature Demo',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            LinearProgressIndicator(
              value: _fadeAnimation.value,
              backgroundColor: Colors.grey[300],
              valueColor: AlwaysStoppedAnimation<Color>(
                Theme.of(context).primaryColor,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _buildStatCard('Performance', '95%', Icons.speed),
                _buildStatCard('Load Time', '0.3s', Icons.timer),
                _buildStatCard('Bundle Size', '-40%', Icons.compress),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon) {
    return Column(
      children: [
        Icon(icon, color: Theme.of(context).primaryColor),
        const SizedBox(height: 8),
        Text(
          value,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(
          title,
          style: TextStyle(
            fontSize: 12,
            color: Colors.grey[600],
          ),
        ),
      ],
    );
  }
}

// Example of a complex computation that would be deferred
class HeavyComputation {
  static Future<List<String>> performComplexCalculation() async {
    // Simulate heavy computation
    await Future.delayed(const Duration(milliseconds: 500));
    
    return List.generate(1000, (index) => 'Computed Item $index');
  }
  
  static Map<String, dynamic> generateLargeDataSet() {
    return Map.fromIterable(
      List.generate(10000, (index) => index),
      key: (item) => 'key_$item',
      value: (item) => {
        'id': item,
        'value': item * 2,
        'computed': item * item,
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      },
    );
  }
}