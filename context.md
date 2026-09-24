Project context: executable fruit-fly connectome + embodied simulation

I want to experiment with an executable model of the Drosophila melanogaster brain derived from a real biological connectome, and eventually connect that brain to a simulated fly body.

1. Biological source: FlyWire

The underlying biological data comes from FlyWire, which reconstructed an adult fruit-fly brain from electron-microscopy data.

The important distinction is:

FlyWire connectome ≠ executable brain simulation.

FlyWire provides the anatomical graph: neurons, neuron IDs, synaptic connectivity, connection counts/weights, annotations, neurotransmitter information, etc.

A useful current dataset is FAFB FlyWire v783. One simulation-ready representation contains roughly:

139k neurons
3.7M connected neuron pairs
~50M individual synapses

Neurons retain their FlyWire IDs, which makes it possible to relate simulated neurons back to biological/anatomical neurons.

2. Reference executable brain: Shiu et al.

The main scientific reference implementation is:

GitHub:
https://github.com/philshiu/Drosophila_brain_model

Paper:
Shiu et al., A leaky integrate-and-fire computational model based on the connectome of the entire adult Drosophila brain reveals insights into sensorimotor processing, Nature 634, 210–219 (2024).

DOI: 10.1038/s41586-024-07763-9

This turns the biological connectivity graph into a leaky-integrate-and-fire (LIF) spiking neural network.

It is important not to describe this as simply a trained artificial neural network. The architecture/connectivity comes from the measured connectome, while mathematical LIF equations supply simplified neuron dynamics.

Conceptually:

FlyWire anatomy
      ↓
neuron IDs + synapses + connection strengths/types
      ↓
assign simplified LIF dynamics to neurons
      ↓
executable spiking network
      ↓
spike times / firing rates

The reference implementation uses Brian2, a Python computational-neuroscience simulator, rather than PyTorch. It can generate C++ for considerably better CPU performance.

Individual neurons can be addressed by FlyWire ID. The reference implementation already supports stimulation and silencing of selected neurons and exposes resulting spike times/rates. Therefore do not treat the network as having one conventional ML-style input tensor and output tensor.

Instead:

INPUT
    ↓
selected biological sensory neurons
    ↓
recurrent connectome
    ↓
selected descending / motor-related neurons
    ↓
OUTPUT

Which neurons constitute inputs and outputs depends upon the experiment.

3. A useful modern implementation with PyTorch

Also inspect:

https://github.com/eonsystemspbc/fly-brain

This project implements the same basic whole-brain LIF idea using several backends:

Brian2 / C++ CPU
Brian2CUDA
PyTorch / CUDA
NEST GPU
GeNN

The PyTorch version represents connectivity as a sparse tensor and implements neuron dynamics as custom nn.Module classes. It uses a 0.1-ms simulation timestep.

This is particularly interesting if the eventual goal is differentiable experiments, GPU execution, learning, parameter optimization or integration into an existing ML stack.

4. Physical fly simulation: FlyGym

FlyGym:
https://github.com/NeLy-EPFL/flygym

FlyGym provides the embodied fly, not the whole-brain model.

It uses MuJoCo for physics and provides an anatomically detailed fly body, joints, contact, locomotion environment, sensory systems and interfaces suitable for controllers.

Think of the architecture as:

                    WORLD
                      │
                      ↓
               FlyGym / MuJoCo
                simulated body
                 ↙         ↖
            sensors       actuators
               ↓             ↑
        sensory neurons   motor/DN readout
               ↓             ↑
             CONNECTOME / LIF
               BRAIN MODEL

FlyGym by itself does not mean that the FlyWire whole brain is controlling the body.

5. Existing integrated projects

Before building the bridge from scratch, investigate:

fly-api:
https://github.com/dtch1997/fly-api

It explicitly aims to package the existing FlyWire + Shiu + FlyGym work into an executable/embodied system. Its demos include sensory-to-motor experiments, walking, visual input and closed-loop brain/body experiments. The authors explicitly distinguish their integration work from the underlying FlyWire, Shiu and FlyGym research.

Also inspect:

Fly-Brain-AI:
https://github.com/neilt93/Fly-Brain-AI

This explicitly connects a ~139k-neuron Brian2 brain simulation to a FlyGym/MuJoCo body and includes a separate visualization component.

Another useful implementation/reference is:

Fruit Fly Laboratory:
https://github.com/vaibhavkedarisetti/fruit-fly-lab

It uses FlyWire FAFB v783 and reproduces the Shiu-style LIF model in a custom CPU engine. It provides explicit mappings such as looming visual stimuli → LC4/LPLC2 neurons → whole-brain simulation → descending neurons → motor channels → digital fly body.

6. Inputs are biological neuron populations

Do not invent a conventional ML input layer.

For a visual experiment, for example, the desired chain is approximately:

simulated visual scene
      ↓
simulated fly retina / ommatidia
      ↓
visual encoding
      ↓
corresponding FlyWire sensory neurons
      ↓
connectome dynamics

For another modality it could instead be:

odor concentration
      ↓
olfactory receptor neuron firing
      ↓
FlyWire olfactory neurons
      ↓
brain

The major scientific/engineering problem is therefore the transduction layer that converts physical sensor values into biologically plausible neural stimulation.

7. Outputs work similarly

There is no universal brain.forward() -> action.

Instead identify biologically relevant output populations, particularly descending neurons (DNs) and motor-related neurons.

For example:

brain spikes
    ↓
selected descending neurons
    ↓
firing-rate/spike decoder
    ↓
behavioral/motor command
    ↓
FlyGym actuator/controller

The mapping from DNs to muscles/joint torques is one of the major abstraction boundaries. Some existing projects use intermediate motor channels or locomotor controllers rather than claiming that every simulated brain spike maps directly to an individual muscle.

8. Brain visualization

Keep anatomical visualization and simulated neural activity conceptually separate.

FlyWire gives anatomical neuron geometries/coordinates.

The executable LIF model gives something like:

timestamp
FlyWire neuron ID
spike / membrane state / firing rate

Because the same neuron IDs correspond to anatomical neurons, simulated activity can be overlaid on the anatomical geometry:

LIF simulation
      │
      └── neuron 7205759... spikes
                        │
                        ↓
                FlyWire neuron ID
                        │
                        ↓
             anatomical coordinates
                        │
                        ↓
             flash/highlight neuron

Therefore a visualization showing parts of a FlyWire brain flashing generally represents simulated activity rendered at biological anatomical locations. The geometry/connectivity can be biological data while the activity itself is generated by the mathematical neuron model.

9. Critical scientific distinction

Never equate this with a faithful digital copy of the biological fly brain.

There are roughly three levels:

HIGH biological confidence
         │
         │  neuron morphology/connectivity
         │  synapse locations/counts
         │  cell annotations
         ↓
MEDIUM / inferred
         │
         │  effective synaptic strength/sign
         │  sensory encoding
         ↓
STRONGLY MODELED
         │
         │  membrane dynamics
         │  thresholds
         │  temporal dynamics
         │  motor decoding
         ↓
LOW biological fidelity / engineering abstraction

The exciting research question is not merely:

"Can this network control a simulated fly?"

because many controllers can do that.

The stronger question is:

"Given the biological connectome and minimal fitted/engineered assumptions, how accurately does the resulting simulation reproduce measured biological neural responses and behavior?"

10. Software architecture I want

Design the software so these pieces are independently replaceable:

┌──────────────────────────────────────────────┐
│                 Experiment                  │
└───────────────────┬──────────────────────────┘
                    │
        ┌───────────▼───────────┐
        │ FlyGym / MuJoCo World│
        └───────┬───────▲───────┘
                │       │
             sensors  actions
                │       ▲
        ┌───────▼───────┴───────┐
        │   Neural I/O Adapter   │
        │ sensory + motor maps   │
        └───────┬───────▲───────┘
                │       │
           stimulation spikes
                │       │
        ┌───────▼───────┴───────┐
        │     Brain Backend      │
        │ Brian2 / PyTorch / etc│
        └───────────┬────────────┘
                    │
        ┌───────────▼────────────┐
        │ FlyWire connectivity   │
        │ IDs + annotations      │
        └────────────────────────┘

            parallel output
                    │
                    ▼
        ┌────────────────────────┐
        │ Brain Visualization    │
        │ geometry + live spikes │
        └────────────────────────┘

Define interfaces approximately like:

class BrainBackend:
    def reset(self): ...
    def stimulate(self, neuron_ids, rates): ...
    def step(self, dt): ...
    def spikes(self): ...
    def activity(self, neuron_ids): ...

class SensoryEncoder:
    def encode(self, observation) -> NeuralStimulus: ...

class MotorDecoder:
    def decode(self, neural_activity) -> MotorCommand: ...

class FlyEnvironment:
    def observe(self): ...
    def step(self, motor_command): ...

Avoid hard-coding the Brian2 implementation into the rest of the architecture so that Brian2 can later be exchanged for PyTorch/CUDA or another simulator.

11. First engineering milestone

Do not start by attempting autonomous full locomotion.

First reproduce a small causal loop:

controlled stimulus
      ↓
known sensory neuron population
      ↓
whole-brain simulation
      ↓
known descending/motor neuron population
      ↓
measurable response

Verify that neuron IDs, spike propagation and expected causal effects agree with the published/reference implementation.

Then make the experiment closed-loop with FlyGym.

Only after that add learning/plasticity or optimize unknown biological parameters.

12. Long-term research direction

Eventually I want a framework where uncertain mapping/model choices are explicit parameters:

biological observations
         ↑
         │ compare
         │
connectome → neuron model → simulated neural activity → behavior
                   ↑
                   │
         optimize model assumptions

This would allow comparing alternative neuron models, synaptic scaling, sensory encodings and motor decoding against actual experimental measurements rather than merely optimizing for successful simulated behavior.
